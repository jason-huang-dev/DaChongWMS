import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ClientsApprovedPage,
  ClientsDeactivatedPage,
} from "@/features/clients/view/ClientsPage";
import { renderWithProviders } from "@/test/render";

const apiGetMock = vi.fn();

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => ({
    company: { id: 1, openid: "tenant-openid", label: "DaChong WMS" },
    activeWarehouse: { id: 7, warehouse_name: "Main WH" },
  }),
}));

vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => apiGetMock(...args),
  };
});

describe("ClientsPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue([
      {
        id: 1,
        organization_id: 1,
        name: "Acme Retail",
        code: "ACM-001",
        contact_name: "Ava Chen",
        contact_email: "ava@acme.example",
        contact_phone: "15550001111",
        billing_email: "billing@acme.example",
        shipping_method: "Express",
        allow_dropshipping_orders: true,
        allow_inbound_goods: true,
        notes: "Primary client",
        is_active: true,
        approval_status: "APPROVED",
        company_name: "Acme Holdings",
        settlement_currency: "USD",
        distribution_mode: "NOT_SUPPORTED",
        total_available_balance: 0,
        credit_limit: 5000,
        credit_used: 1200,
        authorized_order_quantity: 10,
        charging_template_name: "Default USD",
        warehouse_assignments: ["Main WH"],
      },
      {
        id: 2,
        organization_id: 1,
        name: "Dormant Outlet",
        code: "DRM-002",
        contact_name: "Drew Lin",
        contact_email: "drew@dormant.example",
        contact_phone: "15550002222",
        billing_email: "",
        shipping_method: "Ground",
        allow_dropshipping_orders: false,
        allow_inbound_goods: false,
        notes: "Dormant account",
        is_active: false,
        approval_status: "DEACTIVATED",
        company_name: "Dormant Outlet LLC",
        settlement_currency: "USD",
        distribution_mode: "NOT_SUPPORTED",
        total_available_balance: 0,
        credit_limit: 0,
        credit_used: 0,
        authorized_order_quantity: 0,
        warehouse_assignments: ["Overflow WH"],
      },
    ]);
  });

  test("renders the client workbench, filters by lifecycle bucket, and opens the editor dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <MemoryRouter initialEntries={["/clients/approved"]}>
        <Routes>
          <Route path="/clients/approved" element={<ClientsApprovedPage />} />
          <Route path="/clients/deactivated" element={<ClientsDeactivatedPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Acme Retail")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open account" })).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith("/api/v1/organizations/1/customer-accounts/", undefined);

    await user.click(screen.getByRole("tab", { name: /Deactivated/i }));

    await waitFor(() => {
      expect(screen.getByText("Dormant Outlet")).toBeInTheDocument();
    });
    expect(screen.queryByText("Acme Retail")).not.toBeInTheDocument();

    await user.click(screen.getByLabelText("Edit client Dormant Outlet"));

    expect(await screen.findByRole("heading", { name: "Edit client account" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("DRM-002")).toBeInTheDocument();

    await user.click(screen.getByRole("tab", { name: "Assignments and portal" }));

    expect(screen.getByText("Warehouse and charging")).toBeInTheDocument();
    expect(screen.getByText("Finance posture")).toBeInTheDocument();
  });
});
