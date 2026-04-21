import { config } from "@/lib/config";
import { loadStoredSession } from "@/shared/storage/auth-storage";
import type { AuthSession } from "@/shared/types/domain";

type QueryValue = string | number | boolean | null | undefined;
type QueryParams = Record<string, QueryValue>;
type SessionLike = Pick<AuthSession, "openid" | "operatorId"> & Partial<AuthSession>;

export class ApiClientError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiClientError";
    this.status = status;
    this.payload = payload;
  }
}

function normalizePath(path: string) {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const basePath = config.apiBaseUrl.replace(/\/+$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;

  if (normalizedPath === basePath || normalizedPath.startsWith(`${basePath}/`)) {
    return normalizedPath;
  }

  return `${basePath}${normalizedPath}`;
}

function buildUrl(path: string, query?: QueryParams) {
  const normalizedPath = normalizePath(path);
  const url = new URL(normalizedPath, window.location.origin);

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === "") {
        return;
      }
      url.searchParams.set(key, String(value));
    });
  }

  return url.toString();
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  if (contentType.startsWith("text/")) {
    return response.text();
  }
  return response.blob();
}

function buildHeaders(session: SessionLike | null, hasBody: boolean, unauthenticated: boolean) {
  const headers = new Headers();

  if (hasBody) {
    headers.set("Content-Type", "application/json");
  }
  headers.set("Accept", "application/json, text/plain, */*");

  if (!unauthenticated && session) {
    headers.set("TOKEN", session.token ?? session.openid);
    headers.set("OPERATOR", String(session.operatorId));
    headers.set("OPENID", session.openid);
  }

  return headers;
}

async function request<TResponse>(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: {
    body?: unknown;
    query?: QueryParams;
    session?: SessionLike | null;
    unauthenticated?: boolean;
  } = {},
): Promise<TResponse> {
  const { body, query, session = loadStoredSession(), unauthenticated = false } = options;
  const isFormData = body instanceof FormData;
  const headers = buildHeaders(session, body !== undefined && !isFormData, unauthenticated);
  const response = await fetch(buildUrl(path, query), {
    body:
      body === undefined
        ? undefined
        : isFormData
          ? body
          : JSON.stringify(body),
    credentials: "include",
    headers,
    method,
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "detail" in payload && typeof payload.detail === "string"
        ? payload.detail
        : response.statusText || "Request failed";

    throw new ApiClientError(message, response.status, payload);
  }

  return payload as TResponse;
}

export function apiGet<TResponse>(path: string, query?: QueryParams, session?: SessionLike | null) {
  return request<TResponse>("GET", path, { query, session });
}

export function apiGetPublic<TResponse>(path: string, query?: QueryParams) {
  return request<TResponse>("GET", path, { query, session: null, unauthenticated: true });
}

export function apiPost<TResponse>(path: string, body?: unknown, query?: QueryParams | null, unauthenticated = false) {
  return request<TResponse>("POST", path, {
    body,
    query: query ?? undefined,
    unauthenticated,
  });
}

export function apiPostForm<TResponse>(path: string, body: FormData, query?: QueryParams | null, unauthenticated = false) {
  return request<TResponse>("POST", path, {
    body,
    query: query ?? undefined,
    unauthenticated,
  });
}

export function apiPatch<TResponse>(path: string, body?: unknown, query?: QueryParams) {
  return request<TResponse>("PATCH", path, { body, query });
}

export function apiDelete<TResponse>(path: string, query?: QueryParams) {
  return request<TResponse>("DELETE", path, { query });
}
