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

/**
 * Extract a human-readable error message from any backend error response.
 *
 * Handles every format the API currently returns:
 *   - {"error": {"code": "...", "message": "..."}}   (error_response / exception handler)
 *   - {"non_field_errors": ["msg"]}                   (validate_password inside serializer)
 *   - {"detail": "msg"}                              (DRF legacy / throttle)
 *   - {"token": "msg"}                               (serializer validation)
 *   - ["msg"]                                         (bare list)
 *   - "msg"                                           (plain string)
 *   - null / unknown                                  (fallback)
 */
export function extractErrorMessage(data: unknown, fallback: string): string {
  // null / undefined / primitive string
  if (data == null) return fallback
  if (typeof data === 'string') return data.trim() || fallback

  // Array of messages: ["msg"]
  if (Array.isArray(data)) {
    return (typeof data[0] === 'string' && data[0].trim()) || fallback
  }

  // Object — try known shapes
  if (typeof data === 'object') {
    const obj = data as Record<string, unknown>

    // {"error": {"message": "..."}}
    if (obj.error && typeof obj.error === 'object') {
      const errObj = obj.error as Record<string, unknown>
      if (typeof errObj.message === 'string' && errObj.message.trim()) {
        return errObj.message.trim()
      }
    }

    // {"non_field_errors": ["msg"]}
    if (obj.non_field_errors) {
      const ne = obj.non_field_errors
      if (Array.isArray(ne)) return (typeof ne[0] === 'string' && ne[0].trim()) || fallback
      if (typeof ne === 'string') return ne.trim() || fallback
    }

    // {"detail": "msg"}
    if (typeof obj.detail === 'string') return obj.detail.trim() || fallback

    // {"token": "msg"} or any single-key with string value
    const values = Object.values(obj)
    if (values.length === 1 && typeof values[0] === 'string') {
      return (values[0] as string).trim() || fallback
    }
  }

  return fallback
}
