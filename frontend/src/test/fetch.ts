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
      /^\/api\/v1\/organizations\/\d+\/customer-accounts\/$/.test(url.pathname) ||
      /^\/api\/v1\/organizations\/\d+\/warehouses\/$/.test(url.pathname) ||
      /^\/api\/v1\/organizations\/\d+\/fees\/[^/]+\/$/.test(url.pathname)
    ) {
      return jsonResponse([]);
    }
    if (
      url.pathname === "/api/access/company-invites/" ||
      url.pathname === "/api/access/password-resets/" ||
      url.pathname === "/api/access/audit-events/" ||
      url.pathname === "/api/access/workspace-tabs/" ||
      url.pathname === "/api/counting/approvals/queue/" ||
      url.pathname === "/api/inbound/advance-shipment-notices/" ||
      url.pathname === "/api/inbound/purchase-orders/" ||
      url.pathname === "/api/inbound/receipts/" ||
      url.pathname === "/api/inbound/signing-records/" ||
      url.pathname === "/api/inbound/putaway-tasks/" ||
      url.pathname === "/api/inventory/adjustment-reasons/" ||
      url.pathname === "/api/inventory/adjustment-rules/" ||
      url.pathname === "/api/inventory/balances/" ||
      url.pathname === "/api/inventory/movements/" ||
      url.pathname === "/api/outbound/dock-load-verifications/" ||
      url.pathname === "/api/outbound/package-executions/" ||
      url.pathname === "/api/outbound/pick-tasks/" ||
      url.pathname === "/api/outbound/sales-orders/" ||
      url.pathname === "/api/outbound/shipments/" ||
      url.pathname === "/api/reporting/report-exports/" ||
      url.pathname === "/api/reporting/invoice-settlements/" ||
      url.pathname === "/api/reporting/invoice-disputes/" ||
      url.pathname === "/api/reporting/finance-exports/" ||
      url.pathname === "/api/returns/dispositions/" ||
      url.pathname === "/api/returns/receipts/" ||
      url.pathname === "/api/returns/return-orders/" ||
      url.pathname === "/api/transfers/replenishment-tasks/" ||
      url.pathname === "/api/transfers/transfer-orders/"
    ) {
      return jsonResponse(buildPaginatedResponse([]));
    }
    if (url.pathname === "/api/counting/approvals/dashboard/") {
      return jsonResponse({
        pending_sla_hours: 24,
        recount_sla_hours: 12,
        pending_total: 0,
        pending_sla_breach_count: 0,
        pending_age_buckets: {},
        pending_oldest_items: [],
        recount_sla_breach_count: 0,
        recount_items: [],
      });
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
        custom_date_from: null,
        custom_date_to: null,
        visible_widget_keys: ["ops-summary", "order-trends"],
        right_rail_widget_keys: [],
        layout_payload: {
          hidden_widget_keys: [],
          hidden_right_rail_widget_keys: [],
          hidden_queue_section_keys: [],
          hidden_queue_metric_keys: [],
        },
        create_time: "2026-03-15T00:00:00Z",
        update_time: "2026-03-15T00:00:00Z",
      });
    }
    if (url.pathname === "/api/dashboard/order-statistics/") {
      return jsonResponse({
        time_window: "WEEK",
        date_from: "2026-03-23",
        date_to: "2026-03-25",
        summary: {
          dropshipping_orders: 0,
          stock_in_quantity: 0,
        },
        buckets: [
          { date: "2026-03-23", dropshipping_orders: 0, stock_in_quantity: 0 },
          { date: "2026-03-24", dropshipping_orders: 0, stock_in_quantity: 0 },
          { date: "2026-03-25", dropshipping_orders: 0, stock_in_quantity: 0 },
        ],
      });
    }
    throw new Error(`Unhandled fetch request: ${url.toString()}`);
  });

  vi.stubGlobal("fetch", mock as typeof fetch);
  return mock;
}
