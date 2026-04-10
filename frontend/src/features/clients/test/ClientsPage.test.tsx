import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

import {
  ClientsApprovedPage,
  ClientsDeactivatedPage,
} from "@/features/clients/view/ClientsPage";
import { renderWithProviders } from "@/test/render";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();

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
    apiPost: (...args: Parameters<typeof actual.apiPost>) => apiPostMock(...args),
  };
});

describe("ClientsPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
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
        limit_balance_documents: true,
        charging_template_name: "Default USD",
        warehouse_assignments: ["Main WH"],
        contact_people: [
          {
            name: "Warehouse lead",
            email: "warehouse@acme.example",
            phone: "15550003333",
          },
        ],
        create_time: "2026-03-21T09:00:00Z",
        update_time: "2026-03-21T11:15:00Z",
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
        create_time: "2026-03-20T09:00:00Z",
        update_time: "2026-03-20T10:00:00Z",
      },
    ]);
    apiPostMock.mockResolvedValue({
      id: 3,
      organization_id: 1,
      name: "Fresh Client",
      code: "FRS-003",
      contact_name: "",
      contact_email: "",
      contact_phone: "",
      billing_email: "",
      shipping_method: "",
      allow_dropshipping_orders: true,
      allow_inbound_goods: true,
      notes: "",
      is_active: true,
      approval_status: "PENDING_APPROVAL",
    });
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

  test("renders per-column client filters aligned to the grouped table layout", async () => {
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

    expect(screen.getByRole("columnheader", { name: "Customer Code/Name" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Customer Information" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Contact Person" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Finance" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Account Setup" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Time" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Operations" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Customer information field" })).toHaveTextContent("Customer Code");
    expect(screen.getByRole("textbox", { name: "Customer information" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Company information field" })).toHaveTextContent("Company Name");
    expect(screen.getByRole("textbox", { name: "Company information" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Finance field" })).toHaveTextContent("Available Balance");
    expect(screen.getByRole("spinbutton", { name: "Minimum finance value" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Maximum finance value" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Account setup field" })).toHaveTextContent("Charging Template");
    expect(screen.getByRole("textbox", { name: "Account setup" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Time field" })).toHaveTextContent("Created Date");
    expect(screen.getByLabelText("Time from")).toBeInTheDocument();
    expect(screen.getByLabelText("Time to")).toBeInTheDocument();

    expect(screen.getByText("ACM-001")).toBeInTheDocument();
    expect(screen.getByText("Acme Retail")).toBeInTheDocument();
    expect(screen.getByText("Acme Holdings")).toBeInTheDocument();
    expect(screen.getByText("ava@acme.example")).toBeInTheDocument();
    expect(screen.getByText("15550001111")).toBeInTheDocument();
    expect(screen.getByText("Ava Chen")).toBeInTheDocument();
    expect(screen.getAllByText("USD").length).toBeGreaterThan(0);
    expect(screen.getByText("Default USD")).toBeInTheDocument();
    expect(screen.getByText("RWX")).toBeInTheDocument();
    expect(screen.getAllByText("Enabled").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText((_, element) => element?.textContent?.includes("3/21/2026") ?? false).length,
    ).toBeGreaterThan(0);

    await user.type(screen.getByRole("spinbutton", { name: "Minimum finance value" }), "1");

    await waitFor(() => {
      expect(screen.queryByText("Acme Retail")).not.toBeInTheDocument();
    });

    await user.clear(screen.getByRole("spinbutton", { name: "Minimum finance value" }));

    await waitFor(() => {
      expect(screen.getByText("Acme Retail")).toBeInTheDocument();
    });

    await user.click(screen.getByRole("combobox", { name: "Account setup field" }));
    await user.click(screen.getByRole("option", { name: "Charging Template" }));
    await user.type(screen.getByRole("textbox", { name: "Account setup" }), "Default USD");

    await waitFor(() => {
      expect(screen.getByText("Acme Retail")).toBeInTheDocument();
    });

    await user.clear(screen.getByRole("textbox", { name: "Account setup" }));
    await user.type(screen.getByLabelText("Time from"), "2026-03-22");

    await waitFor(() => {
      expect(screen.queryByText("Acme Retail")).not.toBeInTheDocument();
    });
  });

  test("keeps the icon-style operations cell sticky on the right edge and routes reset-password placeholders through the row menu", async () => {
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

    const operationsHeader = screen.getByRole("columnheader", { name: "Operations" });
    const moreActionsButton = screen.getByLabelText("More actions for Acme Retail");

    expect(operationsHeader).toHaveAttribute("data-sticky-column", "right");
    expect(operationsHeader).toHaveStyle({ position: "sticky", right: "0px" });
    expect(screen.getByLabelText("Open portal access for Acme Retail")).toBeInTheDocument();
    expect(screen.queryByLabelText("Open OMS login for Acme Retail")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Edit client Acme Retail")).toBeInTheDocument();
    expect(moreActionsButton.closest("td")).toHaveAttribute("data-sticky-column", "right");
    expect(moreActionsButton.closest("td")).toHaveStyle({ position: "sticky", right: "0px" });

    await user.click(moreActionsButton);

    expect(screen.getByRole("menuitem", { name: "Deactivate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Reset Password" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Obtain Token" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Reset Password" }));

    expect(
      await screen.findByText("Password reset for Acme Retail will be enabled once the client IAM API is available."),
    ).toBeInTheDocument();
  });

  test("renders safely against the current backend customer-account payload shape", async () => {
    apiGetMock.mockResolvedValueOnce([
      {
        id: 11,
        organization_id: 1,
        name: "Backend Only Client",
        code: "BCK-011",
        contact_name: "Bao Li",
        contact_email: "bao@example.com",
        contact_phone: "15550009999",
        billing_email: "billing@example.com",
        shipping_method: "Ground",
        allow_dropshipping_orders: true,
        allow_inbound_goods: false,
        notes: "",
        is_active: true,
        create_time: "2026-03-21T09:00:00Z",
        update_time: "2026-03-21T09:30:00Z",
      },
    ]);

    renderWithProviders(
      <MemoryRouter initialEntries={["/clients/approved"]}>
        <Routes>
          <Route path="/clients/approved" element={<ClientsApprovedPage />} />
          <Route path="/clients/deactivated" element={<ClientsDeactivatedPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("BCK-011")).toBeInTheDocument();
    expect(screen.getAllByText("Backend Only Client").length).toBeGreaterThan(0);
    expect(screen.getByText("bao@example.com")).toBeInTheDocument();
    expect(screen.getByText("Bao Li")).toBeInTheDocument();
    expect(screen.getByText("Not assigned")).toBeInTheDocument();
    expect(screen.getByText("-W-")).toBeInTheDocument();
  });

  test("keeps the table toolbar visible while the client tabs and filters collapse on scroll", async () => {
    renderWithProviders(
      <MemoryRouter initialEntries={["/clients/approved"]}>
        <Routes>
          <Route path="/clients/approved" element={<ClientsApprovedPage />} />
          <Route path="/clients/deactivated" element={<ClientsDeactivatedPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByText("Acme Retail")).toBeInTheDocument();
    expect(screen.getByTestId("client-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("client-page-chrome")).toHaveAttribute("data-collapse-progress", "0.00");
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open account" })).toBeInTheDocument();

    const tableScrollRegion = screen.getByRole("table").parentElement;
    expect(tableScrollRegion).not.toBeNull();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 80 } });

    await waitFor(() => {
      expect(Number(screen.getByTestId("client-page-chrome").getAttribute("data-collapse-progress"))).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("client-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open account" })).toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 220 } });

    await waitFor(() => {
      expect(screen.getByTestId("client-page-chrome")).toHaveAttribute("aria-hidden", "true");
    });

    expect(screen.getByText("0 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open account" })).toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(screen.getByTestId("client-page-chrome")).toHaveAttribute("aria-hidden", "false");
    });
  });

  test("closes the create dialog and shows a success toast after creating a client", async () => {
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

    await user.click(screen.getByRole("button", { name: "Open account" }));

    expect(await screen.findByLabelText("Close client account dialog")).toBeInTheDocument();
    expect(screen.getAllByText("Create client account").length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText("Client code"), "FRS-003");
    await user.type(screen.getByLabelText("Client name"), "Fresh Client");

    await user.click(screen.getByRole("button", { name: "Create client account" }));

    await waitFor(() => {
      expect(screen.queryByLabelText("Close client account dialog")).not.toBeInTheDocument();
    });

    expect(await screen.findByText("Client account for Fresh Client opened successfully.")).toBeInTheDocument();
    expect(apiPostMock).toHaveBeenCalledWith("/api/v1/organizations/1/customer-accounts/", expect.objectContaining({
      code: "FRS-003",
      name: "Fresh Client",
    }));
  });
});
