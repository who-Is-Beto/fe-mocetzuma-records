export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type HttpOptions = {
  method?: HttpMethod;
  headers?: Record<string, string>;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  token?: string | null;
  signal?: AbortSignal;
  credentials?: RequestCredentials;
};

export class HttpError extends Error {
  status: number;
  data: unknown;

  constructor(status: number, message: string, data: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

const buildUrl = (input: string, query?: HttpOptions["query"]) => {
  const base = input.startsWith("http") ? input : `${input}`;
  const url = new URL(
    base,
    typeof window !== "undefined" ? window.location.origin : "http://localhost"
  );

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null) return;
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
};

export async function http<T>(
  path: string,
  options: HttpOptions = {}
): Promise<T> {
  const {
    method = "GET",
    headers = {},
    query,
    body,
    token,
    signal,
    credentials = "same-origin"
  } = options;

  const resolvedUrl = buildUrl(path, query);
  const finalHeaders: Record<string, string> = {
    Accept: "application/json",
    ...headers
  };

  // FormData bodies are passed through untouched so the browser sets the
  // multipart boundary header itself (used for image uploads).
  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;
  const hasBody = body !== undefined && body !== null;
  if (hasBody && !isFormData) {
    finalHeaders["Content-Type"] =
      finalHeaders["Content-Type"] ?? "application/json";
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    method,
    headers: finalHeaders,
    body: hasBody ? ((isFormData ? body : JSON.stringify(body)) as BodyInit) : undefined,
    signal,
    credentials
  });

  const contentType = response.headers.get("content-type");
  const isJson = contentType?.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    throw new HttpError(response.status, response.statusText, payload);
  }

  return payload as T;
}


/**
 * True when the backend rejected the request because the session's email is
 * still unverified (403 + {"error": {"code": "email_not_verified"}}).
 * Shared by every page that gates content behind email verification.
 */
export function isVerificationError(err: unknown): boolean {
  return (
    err instanceof HttpError &&
    err.status === 403 &&
    (err.data as { error?: { code?: string } } | undefined)?.error?.code ===
      "email_not_verified"
  );
}

/** First non-empty string in a DRF error payload, depth-first (field errors, nested lists). */
function firstMessage(value: unknown): string | null {
  if (typeof value === 'string') return value.trim() || null
  if (value !== null && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const message = firstMessage(item)
      if (message) return message
    }
  }
  return null
}

/**
 * Extract a human-readable error message from any backend error response.
 *
 * Takes the parsed payload or the HttpError itself. For an HttpError, 401
 * (English JWT text) and 5xx (server/proxy pages) keep the caller's
 * contextual fallback — neither says anything a user can act on.
 *
 * Handles every format the API currently returns:
 *   - {"error": {"code": "...", "message": "..."}}   (error_response / exception handler)
 *   - {"non_field_errors": ["msg"]}                   (validate_password inside serializer)
 *   - {"detail": "msg"}                              (DRF legacy / throttle)
 *   - {"email": ["msg"]}, {"items": [{}, {"quantity": ["msg"]}]}  (serializer field errors)
 *   - {"token": "msg"}                               (serializer validation)
 *   - ["msg"]                                         (bare list)
 *   - "msg"                                           (plain string; HTML error pages ignored)
 *   - null / unknown                                  (fallback)
 */
export function extractErrorMessage(data: unknown, fallback: string): string {
  if (data instanceof HttpError) {
    if (data.status === 401 || data.status >= 500) return fallback
    data = data.data
  }

  // null / undefined / primitive string
  if (data == null) return fallback
  if (typeof data === 'string') {
    const text = data.trim()
    return text && !text.startsWith('<') ? text : fallback
  }

  // Object — try known shapes
  if (typeof data === 'object' && !Array.isArray(data)) {
    const obj = data as Record<string, unknown>

    // {"error": {"message": "..."}} — never dig further: it also holds the code
    if (obj.error && typeof obj.error === 'object') {
      const message = (obj.error as Record<string, unknown>).message
      return typeof message === 'string' && message.trim() ? message.trim() : fallback
    }

    // {"non_field_errors": ["msg"]}
    if (obj.non_field_errors) return firstMessage(obj.non_field_errors) ?? fallback

    // {"detail": "msg"}
    if (typeof obj.detail === 'string') return obj.detail.trim() || fallback
  }

  // ["msg"], {"token": "msg"}, {"field": ["msg"]}, nested serializer lists
  return firstMessage(data) ?? fallback
}
