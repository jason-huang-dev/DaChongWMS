import { vi } from "vitest";

import { buildPaginatedResponse } from "@/test/factories";

export type FetchHandler = (url: URL, init?: RequestInit) => Response | Promise<Response> | undefined;

export function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
    ...init,
  });
}

export function installFetchMock(...handlers: FetchHandler[]) {
  const mock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const url = new URL(rawUrl, "http://localhost");
    for (const handler of handlers) {
      const result = await handler(url, init);
      if (result !== undefined) {
        return result;
      }
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    throw new Error(`Unhandled fetch request: ${url.toString()}`);
  });

  vi.stubGlobal("fetch", mock as typeof fetch);
  return mock;
}
