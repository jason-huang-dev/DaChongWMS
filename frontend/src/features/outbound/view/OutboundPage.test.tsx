import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { OutboundPage } from "@/features/outbound/view/OutboundPage";
import { saveStoredSession } from "@/shared/storage/auth-storage";
import { buildPaginatedResponse } from "@/test/factories";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

test("renders the expanded outbound workbench sections", async () => {
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
    if (
      url.pathname === "/api/outbound/sales-orders/" ||
      url.pathname === "/api/outbound/pick-tasks/" ||
      url.pathname === "/api/outbound/shipments/" ||
      url.pathname === "/api/outbound/waves/" ||
      url.pathname === "/api/outbound/package-executions/" ||
      url.pathname === "/api/outbound/shipment-documents/" ||
      url.pathname === "/api/outbound/tracking-events/" ||
      url.pathname === "/api/outbound/short-picks/" ||
      url.pathname === "/api/outbound/dock-load-verifications/"
    ) {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  renderWithProviders(
    <MemoryRouter initialEntries={["/outbound"]}>
      <OutboundPage />
    </MemoryRouter>,
    { includeAuth: true },
  );

  expect(await screen.findByText("Outbound operations")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Generate wave" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Package management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stock-out package" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Wave management" })).toBeInTheDocument();
  expect(screen.getAllByText("Logistics tracking").length).toBeGreaterThan(0);
});
