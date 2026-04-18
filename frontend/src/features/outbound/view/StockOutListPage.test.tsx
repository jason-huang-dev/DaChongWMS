import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { StockOutListPage } from "@/features/outbound/view/StockOutListPage";
import { saveStoredSession } from "@/shared/storage/auth-storage";
import { buildPaginatedResponse } from "@/test/factories";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

const stockOutOrders = [
  {
    id: 1,
    warehouse: 1,
    warehouse_name: "Outbound WH",
    customer: 101,
    customer_name: "Acme Retail",
    staging_location: 1,
    staging_location_code: "STAGE-01",
    order_type: "DROPSHIP",
    order_number: "SO-100",
    order_time: "2026-03-20T10:00:00Z",
    requested_ship_date: "2026-03-21",
    expires_at: "2026-03-25T10:00:00Z",
    status: "OPEN",
    fulfillment_stage: "GET_TRACKING_NO",
    exception_state: "NORMAL",
    package_count: 1,
    package_type: "Carton",
    logistics_provider: "UPS",
    shipping_method: "Ground",
    tracking_number: "",
    waybill_number: "",
    waybill_printed: false,
    picking_started_at: null,
    picking_completed_at: null,
    reference_code: "REF-100",
    notes: "",
    lines: [],
    creator: "system",
    create_time: "2026-03-20T10:00:00Z",
    update_time: "2026-03-20T10:00:00Z",
  },
  {
    id: 2,
    warehouse: 1,
    warehouse_name: "Outbound WH",
    customer: 101,
    customer_name: "Acme Retail",
    staging_location: 1,
    staging_location_code: "STAGE-01",
    order_type: "DROPSHIP",
    order_number: "SO-200",
    order_time: "2026-03-21T10:00:00Z",
    requested_ship_date: "2026-03-22",
    expires_at: "2026-03-26T10:00:00Z",
    status: "ALLOCATED",
    fulfillment_stage: "TO_SHIP",
    exception_state: "ABNORMAL_PACKAGE",
    package_count: 4,
    package_type: "Carton",
    logistics_provider: "FedEx",
    shipping_method: "Express",
    tracking_number: "TRK-200",
    waybill_number: "WB-200",
    waybill_printed: true,
    picking_started_at: "2026-03-21T12:00:00Z",
    picking_completed_at: "2026-03-21T13:00:00Z",
    reference_code: "REF-200",
    notes: "",
    lines: [],
    creator: "system",
    create_time: "2026-03-21T09:00:00Z",
    update_time: "2026-03-21T09:00:00Z",
  },
];

function filterOrders(url: URL) {
  let rows = [...stockOutOrders];
  const stage = url.searchParams.get("fulfillment_stage");
  const exceptionState = url.searchParams.get("exception_state");
  const status = url.searchParams.get("status");
  const statusIn = url.searchParams.get("status__in");
  const customer = url.searchParams.get("customer");
  const waybillPrinted = url.searchParams.get("waybill_printed");

  if (stage) {
    rows = rows.filter((row) => row.fulfillment_stage === stage);
  }
  if (exceptionState) {
    rows = rows.filter((row) => row.exception_state === exceptionState);
  }
  if (status) {
    rows = rows.filter((row) => row.status === status);
  }
  if (statusIn) {
    const allowed = statusIn.split(",");
    rows = rows.filter((row) => allowed.includes(row.status));
  }
  if (customer) {
    rows = rows.filter((row) => String(row.customer) === customer);
  }
  if (waybillPrinted) {
    rows = rows.filter((row) => String(row.waybill_printed) === waybillPrinted);
  }

  return rows;
}

test("renders the stock-out list and honors initial queue filters", async () => {
  saveStoredSession({
    username: "outbound-user",
    openid: "tenant-openid",
    operatorId: 9,
    operatorName: "",
    operatorRole: "",
    membershipId: 1,
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/9/") {
      return jsonResponse({
        id: 9,
        staff_name: "Outbound Manager",
        staff_type: "Manager",
        check_code: 8888,
        create_time: "2026-03-21 09:00:00",
        update_time: "2026-03-21 09:00:00",
        error_check_code_counter: 0,
        is_lock: false,
      });
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "Tenant Co",
            company_code: "TENANT",
            company_openid: "tenant-openid",
            company_description: "Primary tenant",
            staff_id: 9,
            staff_name: "Outbound Manager",
            staff_type: "Manager",
            username: "outbound-user",
            email: "outbound@example.com",
            profile_token: "",
            check_code: 8888,
            is_lock: false,
            default_warehouse: 1,
            default_warehouse_name: "Outbound WH",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: null,
            is_current: true,
            invited_by: "",
            create_time: "2026-03-21 09:00:00",
            update_time: "2026-03-21 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Outbound WH",
            warehouse_city: "New York",
            warehouse_address: "200 Ship St",
            warehouse_contact: "555-1100",
            warehouse_manager: "Outbound Lead",
            creator: "system",
            create_time: "2026-03-21 09:00:00",
            update_time: "2026-03-21 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/sales-orders/") {
      return jsonResponse(buildPaginatedResponse(filterOrders(url)));
    }
    return undefined;
  });

  renderWithProviders(
    <MemoryRouter initialEntries={["/outbound?salesOrderException=ABNORMAL_PACKAGE"]}>
      <StockOutListPage />
    </MemoryRouter>,
    { includeAuth: true },
  );

  expect(await screen.findByText("Stock-out list")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Generate wave" })).toBeInTheDocument();
  expect(screen.getByText("Queue states")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "SO-200" })).toHaveAttribute("href", "/outbound/sales-orders/2");
  expect(screen.queryByRole("link", { name: "SO-100" })).not.toBeInTheDocument();
  expect(screen.getByText("Abnormal package")).toBeInTheDocument();
});
