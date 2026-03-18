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
    if (
      url.pathname === "/api/access/company-invites/" ||
      url.pathname === "/api/access/password-resets/" ||
      url.pathname === "/api/access/audit-events/" ||
      url.pathname === "/api/access/workspace-tabs/" ||
      url.pathname === "/api/outbound/dock-load-verifications/"
    ) {
      return jsonResponse(buildPaginatedResponse([]));
    }
    if (url.pathname === "/api/access/workspace-tabs/sync/") {
      return jsonResponse({
        id: 1,
        membership_id: 1,
        route_key: "dashboard",
        route_path: "/dashboard",
        title: "Dashboard",
        icon_key: "",
        position: 0,
        is_active: true,
        is_pinned: false,
        state_payload: {},
        context_payload: {},
        last_opened_at: "2026-03-15T00:00:00Z",
        create_time: "2026-03-15T00:00:00Z",
        update_time: "2026-03-15T00:00:00Z",
      });
    }
    if (url.pathname === "/api/access/workbench-preferences/current/") {
      return jsonResponse({
        id: 1,
        membership_id: 1,
        page_key: "dashboard",
        time_window: "WEEK",
        visible_widget_keys: [],
        right_rail_widget_keys: [],
        layout_payload: {},
        create_time: "2026-03-15T00:00:00Z",
        update_time: "2026-03-15T00:00:00Z",
      });
    }
    throw new Error(`Unhandled fetch request: ${url.toString()}`);
  });

  vi.stubGlobal("fetch", mock as typeof fetch);
  return mock;
}
