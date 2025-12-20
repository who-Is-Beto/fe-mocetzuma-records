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

  const isJsonBody = body !== undefined && body !== null;
  if (isJsonBody) {
    finalHeaders["Content-Type"] =
      finalHeaders["Content-Type"] ?? "application/json";
  }

  if (token) {
    finalHeaders.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolvedUrl, {
    method,
    headers: finalHeaders,
    body: isJsonBody ? JSON.stringify(body) : undefined,
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
