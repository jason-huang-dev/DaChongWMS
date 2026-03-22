import { MemoryRouter } from "react-router-dom";
import { screen } from "@testing-library/react";
import { expect, test } from "vitest";

import { WorkOrdersPage } from "@/features/work-orders/view/WorkOrdersPage";
import { saveStoredSession } from "@/shared/storage/auth-storage";
import { buildPaginatedResponse } from "@/test/factories";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { renderWithProviders } from "@/test/render";

test("renders the work-order management workbench", async () => {
  saveStoredSession({
    username: "manager-user",
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
        staff_name: "Manager User",
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
            staff_name: "Manager User",
            staff_type: "Manager",
            username: "manager-user",
            email: "manager@example.com",
            profile_token: "",
            check_code: 8888,
            is_lock: false,
            default_warehouse: 1,
            default_warehouse_name: "Main Warehouse",
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
            warehouse_name: "Main Warehouse",
            warehouse_city: "Shenzhen",
            warehouse_address: "1 Warehouse Road",
            warehouse_contact: "Ops Desk",
            warehouse_manager: "Alice",
            creator: "system",
            create_time: "2026-03-21 09:00:00",
            update_time: "2026-03-21 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/v1/organizations/1/customer-accounts/") {
      return jsonResponse([
        {
          id: 10,
          organization_id: 1,
          name: "Retail Client",
          code: "RTL-1",
          contact_name: "Store Ops",
          contact_email: "ops@example.com",
          contact_phone: "+1-555-0100",
          billing_email: "billing@example.com",
          shipping_method: "Express",
          allow_dropshipping_orders: true,
          allow_inbound_goods: true,
          notes: "",
          is_active: true,
        },
      ]);
    }
    if (url.pathname === "/api/v1/organizations/1/work-order-types/") {
      return jsonResponse([
        {
          id: 100,
          organization_id: 1,
          code: "dropship-rush",
          name: "Dropship rush",
          description: "Rush work",
          workstream: "OUTBOUND",
          default_urgency: "CRITICAL",
          default_priority_score: 95,
          target_sla_hours: 6,
          is_active: true,
        },
      ]);
    }
    if (url.pathname === "/api/v1/organizations/1/work-orders/") {
      return jsonResponse([
        {
          id: 200,
          organization_id: 1,
          display_code: "WO-00200",
          work_order_type_id: 100,
          work_order_type_name: "Dropship rush",
          workstream: "OUTBOUND",
          warehouse_id: 1,
          warehouse_name: "Main Warehouse",
          customer_account_id: 10,
          customer_account_name: "Retail Client",
          title: "Fulfill SO-1001 first",
          source_reference: "SO-1001",
          status: "READY",
          urgency: "CRITICAL",
          priority_score: 95,
          assignee_name: "Shift A",
          scheduled_start_at: "2026-03-22T09:00:00Z",
          due_at: "2026-03-22T11:00:00Z",
          started_at: null,
          completed_at: null,
          estimated_duration_minutes: 45,
          notes: "",
          fulfillment_rank: 1,
          sla_status: "DUE_SOON",
          created_at: "2026-03-22T08:00:00Z",
          updated_at: "2026-03-22T08:15:00Z",
        },
      ]);
    }
    return undefined;
  });

  renderWithProviders(
    <MemoryRouter initialEntries={["/work-orders"]}>
      <WorkOrdersPage />
    </MemoryRouter>,
    { includeAuth: true },
  );

  expect(await screen.findByText("Work order management")).toBeInTheDocument();
  expect(await screen.findByText("Tenant Co")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Work order type management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Work order manage" })).toBeInTheDocument();
  expect(screen.getAllByText("WO-00200").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Dropship rush").length).toBeGreaterThan(0);
});
