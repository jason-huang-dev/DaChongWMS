import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { expect, test, vi } from "vitest";

import { saveStoredSession } from "@/shared/storage/auth-storage";
import { loadSessionRouteBreadcrumbs, persistSessionRouteBreadcrumbs } from "@/shared/storage/route-breadcrumb-storage";
import type { LocationRecord } from "@/shared/types/domain";
import { installFetchMock, jsonResponse } from "@/test/fetch";
import { buildPaginatedResponse, buildStaffRecord } from "@/test/factories";
import { renderWithRouter } from "@/test/render";

function expectDocumentOrder(before: Element, after: Element) {
  expect(before.compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
}

function installBreadcrumbMeasurementMocks(clientWidth = 1200) {
  const clientWidthDescriptor = Object.getOwnPropertyDescriptor(HTMLElement.prototype, "clientWidth");
  const innerWidthDescriptor = Object.getOwnPropertyDescriptor(window, "innerWidth");
  const boundingRectSpy = vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
    const element = this as HTMLElement;
    const text = element.getAttribute("data-breadcrumb-label") ?? element.textContent?.trim() ?? "";
    const ariaLabel = element.getAttribute("aria-label") ?? "";
    const baseWidth =
      ariaLabel === "Show hidden visited pages" || text.startsWith("+") || text.startsWith("...+") ? 60 : Math.min(240, Math.max(88, text.length * 7));
    const width = baseWidth + (element.querySelector(".breadcrumb-remove") ? 24 : 0);

    return {
      bottom: 24,
      height: 24,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as DOMRect;
  });

  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get() {
      return clientWidth;
    },
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: clientWidth,
  });

  return () => {
    boundingRectSpy.mockRestore();
    if (clientWidthDescriptor) {
      Object.defineProperty(HTMLElement.prototype, "clientWidth", clientWidthDescriptor);
    } else {
      Reflect.deleteProperty(HTMLElement.prototype, "clientWidth");
    }
    if (innerWidthDescriptor) {
      Object.defineProperty(window, "innerWidth", innerWidthDescriptor);
      return;
    }
    Reflect.deleteProperty(window, "innerWidth");
  };
}

function buildLocationRecord(overrides: Partial<LocationRecord> = {}): LocationRecord {
  return {
    id: 15,
    warehouse: 1,
    warehouse_name: "Main WH",
    zone: 7,
    zone_code: "STOR",
    location_type: 3,
    location_type_code: "STORAGE",
    location_code: "A-01-01",
    location_name: "Storage Rack A-01-01",
    aisle: "A",
    bay: "01",
    level: "01",
    slot: "01",
    barcode: "A-01-01",
    capacity_qty: "100",
    max_weight: "0",
    max_volume: "0",
    pick_sequence: 1,
    is_pick_face: false,
    is_locked: false,
    status: "ACTIVE",
    creator: "Route Tester",
    openid: "tenant-openid",
    create_time: "2026-03-14 09:00:00",
    update_time: "2026-03-14 09:15:00",
    ...overrides,
  };
}

test("redirects anonymous users to the login page for protected routes", async () => {
  const { router } = renderWithRouter(["/dashboard"]);

  expect(await screen.findByRole("heading", { name: "Sign in to the operator console" })).toBeInTheDocument();
  expect(screen.getByAltText("DaChong brand logo")).toBeInTheDocument();
  expect(screen.getByText(/Sign in with your warehouse account/i)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/login");
});

test("renders the signup page for anonymous users", async () => {
  const { router } = renderWithRouter(["/signup"]);

  expect(await screen.findByText("Create workspace account")).toBeInTheDocument();
  expect(screen.getByText(/MFA enrollment and recovery/i)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/signup");
});

test("renders the MFA challenge page when a pending challenge exists", async () => {
  window.sessionStorage.setItem(
    "dachongwms.auth.pending-mfa",
    JSON.stringify({
      username: "mfa-user",
      challengeId: "challenge-123",
      expiresAt: "2026-03-15T10:30:00Z",
      availableMethods: ["totp", "recovery_code"],
    }),
  );

  const { router } = renderWithRouter(["/mfa/challenge"]);

  expect(await screen.findByText("Verify multi-factor authentication")).toBeInTheDocument();
  expect(screen.getByText(/challenge expires at/i)).toBeInTheDocument();
  expect(router.state.location.pathname).toBe("/mfa/challenge");
});

test("redirects unauthorized users away from finance routes", async () => {
  saveStoredSession({
    username: "worker",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Inbound"));
    }
    return undefined;
  });

  const { router } = renderWithRouter(["/finance"]);

  await waitFor(() => {
    expect(router.state.location.pathname).toBe("/not-authorized");
  });
  expect(await screen.findByRole("heading", { name: "Not authorized" })).toBeInTheDocument();
});

test("renders the inventory workspace with breadcrumbs for authorized operators", async () => {
  const restoreBreadcrumbMeasurements = installBreadcrumbMeasurementMocks();
  const user = userEvent.setup();

  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Manager",
            username: "manager",
            email: "manager@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: 1,
            default_warehouse_name: "Main WH",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            warehouse_code: "WH-MAIN",
            company: 1,
            company_name: "DaChong WMS",
            contact_name: "Route Tester",
            contact_phone: "",
            contact_email: "",
            country: "",
            state: "",
            city: "",
            district: "",
            address_line_1: "",
            address_line_2: "",
            postal_code: "",
            timezone: "America/New_York",
            is_default: true,
            is_active: true,
            manager_name: "",
            notes: "",
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname.endsWith("/inventory/information/")) {
      return jsonResponse(
        {
          ...buildPaginatedResponse([
            {
              id: "live:1:SKU-001",
              merchantSku: "SKU-001",
              productName: "Scanner",
              productBarcode: "BC-001",
              productCategory: "Hardware",
              productBrand: "DaChong",
              productDescription: "Warehouse scanner",
              productTags: ["DaChong", "Hardware"],
              clients: [],
              shelf: "A-01-01",
              shelves: ["A-01-01"],
              inTransit: 0,
              pendingReceival: 0,
              toList: 1,
              orderAllocated: 2,
              availableStock: 9,
              defectiveProducts: 0,
              totalInventory: 12,
              listingTime: "2026-03-14",
              actualLength: "",
              actualWidth: "",
              actualHeight: "",
              actualWeight: "",
              measurementUnit: "EA",
              merchantCode: "",
              customerCode: "",
              warehouseName: "Main WH",
              stockStatus: "AVAILABLE",
              stockStatuses: ["AVAILABLE"],
              zoneCode: "STOR",
              zoneCodes: ["STOR"],
              locationTypeCode: "STORAGE",
              locationTypeCodes: ["STORAGE"],
              areaKey: "storage",
              areaLabel: "Storage",
              source: "live",
            },
          ]),
          filterOptions: {
            warehouses: [{ value: "Main WH", label: "Main WH" }],
            tags: [
              { value: "DaChong", label: "DaChong" },
              { value: "Hardware", label: "Hardware" },
            ],
            clients: [],
            skus: [{ value: "SKU-001", label: "SKU-001" }],
          },
        },
      );
    }
    if (url.pathname === "/api/reporting/report-exports/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  try {
    renderWithRouter(["/inventory"]);

    const breadcrumb = await screen.findByRole("navigation", { name: "breadcrumb" });

    expect(screen.queryByText("Inventory operations")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Inventory Information" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Stock Count" })).not.toBeInTheDocument();
    expect((await screen.findAllByText("SKU-001")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Main WH").length).toBeGreaterThan(0);
    expect(screen.getByRole("combobox", { name: "Warehouse filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Client filter" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Product info field" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Product info" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Shelf" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Numeric column" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Minimum value" })).toBeInTheDocument();
    expect(screen.getByRole("spinbutton", { name: "Maximum value" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /All areas\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Storage area\(1\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Picking area\(0\)/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Defective area\(0\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export queried rows" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Download template" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import XLSX" })).toBeInTheDocument();
    const checkboxes = screen.getAllByRole("checkbox");
    expect(checkboxes.length).toBeGreaterThanOrEqual(2);
    await user.click(checkboxes[1]);
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Export selected rows" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Print selected labels" })).toHaveLength(1);
    expect(screen.queryByRole("navigation", { name: "Inventory quick access" })).not.toBeInTheDocument();
    const currentBreadcrumbLink = within(breadcrumb).getByRole("link", { name: "Inventory information" });
    expect(currentBreadcrumbLink).toHaveAttribute("href", "/inventory");
    expect(currentBreadcrumbLink).toHaveAttribute("aria-current", "page");
    expect(within(breadcrumb).queryByRole("link", { name: "Inventory" })).not.toBeInTheDocument();
    expect(screen.queryByText("All inventory pages")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide inventory sidebar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inventory Movements" })).toHaveAttribute("href", "/inventory/movements");
    expect(screen.getByRole("link", { name: "Stock Age Report" })).toHaveAttribute("href", "/inventory/aging");
  } finally {
    restoreBreadcrumbMeasurements();
  }
});

test("renders the inventory movements page inside the inventory workspace", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Manager",
            username: "manager",
            email: "manager@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: 1,
            default_warehouse_name: "Main WH",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            warehouse_code: "WH-MAIN",
            company: 1,
            company_name: "DaChong WMS",
            contact_name: "Route Tester",
            contact_phone: "",
            contact_email: "",
            country: "",
            state: "",
            city: "",
            district: "",
            address_line_1: "",
            address_line_2: "",
            postal_code: "",
            timezone: "America/New_York",
            is_default: true,
            is_active: true,
            manager_name: "",
            notes: "",
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname.endsWith("/inventory/movements/")) {
      return jsonResponse({
        ...buildPaginatedResponse([
          {
            id: 101,
            warehouseId: 1,
            warehouseName: "Main WH",
            productId: 88,
            merchantSku: "SKU-001",
            productName: "Scanner",
            productBarcode: "BC-001",
            clientCode: "RTL-1",
            clientName: "Retail Client",
            movementType: "RECEIPT",
            movementTypeLabel: "Receipt",
            entryTypeLabel: "Standard Stock-in",
            stockStatus: "AVAILABLE",
            quantity: 8,
            fromLocationCode: "",
            toLocationCode: "A-01-01",
            referenceCode: "PO-1001",
            sourceDocumentNumber: "RCPT-2001",
            linkedDocumentNumbers: [
              { label: "Stock-in No.", value: "RCPT-2001" },
              { label: "Receiving Serial Number", value: "R5ZG260402210815" },
              { label: "Listing Serial Number", value: "PT-RCPT-2001-1" },
            ],
            sourceDocumentNumbers: [{ label: "Purchase Order", value: "PO-2001" }],
            purchaseOrderNumber: "PO-2001",
            receiptNumber: "RCPT-2001",
            asnNumber: "",
            batchNumber: "BO20260402008",
            serialNumber: "R5ZG260402210815",
            shelfCode: "A-01-01",
            quantityBeforeChange: 0,
            remainingBatchQuantity: 8,
            reason: "Inbound receipt",
            performedBy: "manager@example.com",
            occurredAt: "2026-04-02T18:30:00Z",
            resultingFromQty: null,
            resultingToQty: 8,
            resultingQuantity: 8,
            resultingLocationCode: "A-01-01",
          },
        ]),
        filterOptions: {
          warehouses: [{ value: "1", label: "Main WH" }],
          movementTypes: [{ value: "RECEIPT", label: "Receipt" }],
        },
      });
    }
    return undefined;
  });

  renderWithRouter(["/inventory/movements"]);

  expect(await screen.findByText("SKU-001")).toBeInTheDocument();
  expect(screen.getByRole("combobox", { name: "Movement Types" })).toBeInTheDocument();
  expect(screen.getByRole("textbox", { name: "Merchant SKU" })).toBeInTheDocument();
});

test("records the dashboard breadcrumb only once when the root route redirects there", async () => {
  const restoreBreadcrumbMeasurements = installBreadcrumbMeasurementMocks();

  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    return undefined;
  });

  try {
    const { router } = renderWithRouter(["/"]);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/dashboard");
    });

    expect(await screen.findByRole("button", { name: "Customize dashboard" })).toBeInTheDocument();
    const breadcrumb = await screen.findByRole("navigation", { name: "breadcrumb" });

    expect(within(breadcrumb).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard"]);
    expect(loadSessionRouteBreadcrumbs()).toEqual([{ href: "/dashboard", labelKey: "Dashboard" }]);
  } finally {
    restoreBreadcrumbMeasurements();
  }
});

test("renders the inventory aging page inside the inventory workspace", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/inventory/balances/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse: 1,
            warehouse_name: "Main WH",
            location: 15,
            location_code: "A-01-01",
            goods: 101,
            goods_code: "SKU-001",
            stock_status: "AVAILABLE",
            lot_number: "LOT-1",
            serial_number: "",
            on_hand_qty: "12.0000",
            allocated_qty: "2.0000",
            hold_qty: "1.0000",
            available_qty: "9.0000",
            unit_cost: "4.5000",
            currency: "USD",
            creator: "Route Tester",
            last_movement_at: "2026-03-14T10:00:00Z",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:15:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/locations/") {
      return jsonResponse(buildPaginatedResponse([buildLocationRecord()]));
    }
    if (url.pathname === "/api/reporting/report-exports/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  renderWithRouter(["/inventory/aging"]);

  expect(screen.queryByText("Inventory operations")).not.toBeInTheDocument();
  expect(await screen.findByRole("heading", { name: "Stock Age Report" })).toBeInTheDocument();
  expect(screen.queryByRole("heading", { name: "Inventory Information" })).not.toBeInTheDocument();
});

test("persists visited pages in the breadcrumb row for quick return across the session", async () => {
  const user = userEvent.setup();
  const restoreBreadcrumbMeasurements = installBreadcrumbMeasurementMocks();

  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/inventory/balances/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse: 1,
            warehouse_name: "Main WH",
            location: 15,
            location_code: "A-01-01",
            goods: 101,
            goods_code: "SKU-001",
            stock_status: "AVAILABLE",
            lot_number: "LOT-1",
            serial_number: "",
            on_hand_qty: "12.0000",
            allocated_qty: "2.0000",
            hold_qty: "1.0000",
            available_qty: "9.0000",
            unit_cost: "4.5000",
            currency: "USD",
            creator: "Route Tester",
            last_movement_at: "2026-03-14T10:00:00Z",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:15:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/locations/") {
      return jsonResponse(buildPaginatedResponse([buildLocationRecord()]));
    }
    if (url.pathname === "/api/reporting/report-exports/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  try {
    persistSessionRouteBreadcrumbs([{ href: "/dashboard", labelKey: "Dashboard" }]);
    renderWithRouter(["/inventory"]);

    const breadcrumb = await screen.findByRole("navigation", { name: "breadcrumb" });
    const measurementLane = within(breadcrumb).getByTestId("route-breadcrumbs-measurements");

    expect(within(breadcrumb).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Inventory information"]);
    expect(within(breadcrumb).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(within(breadcrumb).getByRole("link", { name: "Inventory information" })).toHaveAttribute("href", "/inventory");
    expect(within(breadcrumb).getByRole("link", { name: "Inventory information" })).toHaveAttribute("aria-current", "page");
    expect(within(breadcrumb).queryByRole("button", { name: "Show hidden visited pages" })).not.toBeInTheDocument();
    expect(measurementLane).toHaveTextContent("Dashboard");
    expect(measurementLane).toHaveTextContent("Inventory information");
    expect(loadSessionRouteBreadcrumbs()).toEqual([
      { href: "/dashboard", labelKey: "Dashboard" },
      { href: "/inventory", labelKey: "Inventory information" },
    ]);

    await user.hover(within(screen.getByRole("navigation", { name: "breadcrumb" })).getByRole("link", { name: "Dashboard" }));
    await user.click(screen.getByRole("button", { name: "Remove from quick access: Dashboard" }));

    expect(within(screen.getByRole("navigation", { name: "breadcrumb" })).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(loadSessionRouteBreadcrumbs()).toEqual([{ href: "/inventory", labelKey: "Inventory information" }]);
  } finally {
    restoreBreadcrumbMeasurements();
  }
});

test("shows persisted breadcrumb history when another visited page becomes active", async () => {
  const user = userEvent.setup();
  const restoreBreadcrumbMeasurements = installBreadcrumbMeasurementMocks();

  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    return undefined;
  });

  try {
    persistSessionRouteBreadcrumbs([
      { href: "/dashboard", labelKey: "Dashboard" },
      { href: "/inventory", labelKey: "Inventory information" },
    ]);

    renderWithRouter(["/dashboard"]);

    expect(await screen.findByRole("button", { name: "Customize dashboard" })).toBeInTheDocument();
    const breadcrumb = await screen.findByRole("navigation", { name: "breadcrumb" });

    expect(within(breadcrumb).getAllByRole("link").map((link) => link.textContent)).toEqual(["Dashboard", "Inventory information"]);
    expect(within(breadcrumb).getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(within(breadcrumb).getByRole("link", { name: "Dashboard" })).toHaveAttribute("aria-current", "page");
    expect(within(breadcrumb).getByRole("link", { name: "Inventory information" })).toHaveAttribute("href", "/inventory");
    expect(loadSessionRouteBreadcrumbs()).toEqual([
      { href: "/dashboard", labelKey: "Dashboard" },
      { href: "/inventory", labelKey: "Inventory information" },
    ]);

    await user.hover(within(screen.getByRole("navigation", { name: "breadcrumb" })).getByRole("link", { name: "Inventory information" }));
    await user.click(screen.getByRole("button", { name: "Remove from quick access: Inventory information" }));

    expect(within(screen.getByRole("navigation", { name: "breadcrumb" })).queryByRole("link", { name: "Inventory information" })).not.toBeInTheDocument();
    expect(loadSessionRouteBreadcrumbs()).toEqual([{ href: "/dashboard", labelKey: "Dashboard" }]);
  } finally {
    restoreBreadcrumbMeasurements();
  }
});

test("collapses overflowing breadcrumb history into a hidden-pages trigger", async () => {
  const user = userEvent.setup();
  const recentEntries = [
    { href: "/inventory", labelKey: "Inventory information" },
    { href: "/dashboard", labelKey: "Dashboard" },
    ...Array.from({ length: 10 }, (_, index) => ({
      href: `/history-${index + 1}`,
      labelKey: `Overflow history item ${index + 1} with a very long recent page label`,
    })),
  ];
  const overflowEntry = recentEntries[recentEntries.length - 1];
  const restoreBreadcrumbMeasurements = installBreadcrumbMeasurementMocks(860);

  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/inventory/balances/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse: 1,
            warehouse_name: "Main WH",
            location: 15,
            location_code: "A-01-01",
            goods: 101,
            goods_code: "SKU-001",
            stock_status: "AVAILABLE",
            lot_number: "LOT-1",
            serial_number: "",
            on_hand_qty: "12.0000",
            allocated_qty: "2.0000",
            hold_qty: "1.0000",
            available_qty: "9.0000",
            unit_cost: "4.5000",
            currency: "USD",
            creator: "Route Tester",
            last_movement_at: "2026-03-14T10:00:00Z",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:15:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/reporting/report-exports/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  persistSessionRouteBreadcrumbs(recentEntries);

  try {
    renderWithRouter(["/inventory"]);

    const breadcrumb = await screen.findByRole("navigation", { name: "breadcrumb" });
    const rail = within(breadcrumb).getByTestId("route-breadcrumbs-rail");
    const measurementLane = within(breadcrumb).getByTestId("route-breadcrumbs-measurements");
    const visibleLabels = within(breadcrumb).getAllByRole("link").map((link) => link.textContent ?? "");
    const visibleLinks = within(breadcrumb).getAllByRole("link");
    const overflowTrigger = within(breadcrumb).getByRole("button", { name: "Show hidden visited pages" });

    expect(visibleLabels).toEqual([
      "Inventory information",
      "Dashboard",
      "Overflow history item 1 with a very long recent page label",
    ]);
    expect(overflowTrigger).toHaveTextContent("...+9");
    expect(within(breadcrumb).queryByRole("link", { name: overflowEntry.labelKey })).not.toBeInTheDocument();
    expect(measurementLane).toHaveTextContent("Inventory information");
    expect(measurementLane).toHaveTextContent("Dashboard");
    expect(measurementLane).toHaveTextContent("...+9");
    visibleLinks.forEach((link) => {
      expectDocumentOrder(link, overflowTrigger);
    });
    expectDocumentOrder(visibleLinks[visibleLinks.length - 1]!, overflowTrigger);
    expect(overflowTrigger.parentElement).toBe(rail);
    expect(rail.lastElementChild).toBe(overflowTrigger);

    await user.click(overflowTrigger);
    expect(await screen.findByRole("menu", { name: "Recent pages" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: overflowEntry.labelKey })).toHaveAttribute("href", overflowEntry.href);
    await user.click(screen.getByRole("button", { name: `Remove from recent pages: ${overflowEntry.labelKey}` }));

    expect(loadSessionRouteBreadcrumbs()).toEqual(recentEntries.filter((entry) => entry.href !== overflowEntry.href));
    expect(screen.queryByRole("link", { name: overflowEntry.labelKey })).not.toBeInTheDocument();
  } finally {
    restoreBreadcrumbMeasurements();
  }
});

test("renders the MFA enrollment page for authenticated operators", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/mfa/status/") {
      return jsonResponse({
        has_verified_enrollment: false,
        enrollment_required: true,
        primary_enrollment: null,
        recovery_codes_remaining: 0,
        verified_methods: [],
      });
    }
    return undefined;
  });

  renderWithRouter(["/mfa/enroll"]);

  expect(await screen.findByText("Security and MFA")).toBeInTheDocument();
  expect(screen.getByText(/MFA is not enabled yet/i)).toBeInTheDocument();
  expect(screen.getByText("Create authenticator setup")).toBeInTheDocument();
});

test("renders security access management for managers", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/staff/") {
      return jsonResponse(buildPaginatedResponse([buildStaffRecord("Inbound", { id: 12, staff_name: "Dock User" })]));
    }
    if (url.pathname === "/api/staff/type/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            staff_type: "Manager",
            creator: "Seeder",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
          {
            id: 2,
            staff_type: "Inbound",
            creator: "Seeder",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/mfa/status/") {
      return jsonResponse({
        has_verified_enrollment: true,
        enrollment_required: false,
        primary_enrollment: {
          id: 1,
          label: "Primary authenticator",
          method: "totp",
          is_verified: true,
          is_primary: true,
          verified_at: "2026-03-14T09:00:00Z",
          create_time: "2026-03-14T09:00:00Z",
        },
        recovery_codes_remaining: 8,
        verified_methods: ["totp"],
      });
    }
    return undefined;
  });

  renderWithRouter(["/security"]);

  expect(await screen.findByText("Security and access")).toBeInTheDocument();
  expect(await screen.findByText("Staff access directory")).toBeInTheDocument();
  expect(screen.getByText("Dock User")).toBeInTheDocument();
  expect(screen.getByText("Manage my MFA")).toBeInTheDocument();
});

test("renders client management for authorized operators", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Manager",
            username: "manager",
            email: "manager@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: null,
            default_warehouse_name: "",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    if (url.pathname === "/api/v1/organizations/1/customer-accounts/") {
      return jsonResponse([
        {
          id: 1,
          organization_id: 1,
          name: "Acme Retail",
          code: "ACM-1",
          contact_name: "Store Ops",
          contact_email: "ops@acme.example",
          contact_phone: "+1-555-0100",
          billing_email: "billing@acme.example",
          shipping_method: "Express",
          allow_dropshipping_orders: true,
          allow_inbound_goods: true,
          notes: "Primary client",
          is_active: true,
        },
      ]);
    }
    return undefined;
  });

  renderWithRouter(["/clients"]);

  expect(await screen.findByRole("button", { name: "Open account" })).toBeInTheDocument();
  expect((await screen.findAllByText("Acme Retail")).length).toBeGreaterThan(0);
  expect(screen.getByText("ACM-1")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: /Approved\(1\)/i })).toBeInTheDocument();
});

test("renders product management for authorized operators", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Manager",
            username: "manager",
            email: "manager@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: null,
            default_warehouse_name: "",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    if (url.pathname === "/api/v1/organizations/1/products/") {
      return jsonResponse([
        {
          id: 10,
          organization_id: 1,
          sku: "SKU-001",
          name: "Bluetooth Scanner",
          barcode: "1234567890",
          unit_of_measure: "EA",
          category: "Devices",
          brand: "DaChong",
          description: "Handheld scanner",
          is_active: true,
        },
      ]);
    }
    return undefined;
  });

  renderWithRouter(["/products"]);

  expect(await screen.findByText("Product management")).toBeInTheDocument();
  expect(await screen.findByText("Bluetooth Scanner")).toBeInTheDocument();
  expect(screen.getByText("SKU-001")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Create product" })).toBeInTheDocument();
});

test("renders fees management for authorized finance operators", async () => {
  saveStoredSession({
    username: "finance-manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Finance"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Finance",
            username: "finance-manager",
            email: "finance@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: null,
            default_warehouse_name: "",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  renderWithRouter(["/finance"]);

  expect(await screen.findByText("Fees management")).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Recharge / Deduction" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Voucher Management" }).length).toBeGreaterThan(0);
});

test("renders statistics for authorized operators", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
    membershipId: 1,
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/access/my-memberships/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            company_id: 1,
            company_name: "DaChong WMS",
            company_code: "DCWMS",
            company_openid: "tenant-openid",
            company_description: "Primary workspace",
            staff_id: 11,
            staff_name: "Route Tester",
            staff_type: "Manager",
            username: "manager",
            email: "manager@example.com",
            profile_token: "token-1",
            check_code: 8888,
            is_lock: false,
            default_warehouse: 1,
            default_warehouse_name: "Main WH",
            is_company_admin: true,
            can_manage_users: true,
            is_active: true,
            last_selected_at: "2026-03-21T00:00:00Z",
            is_current: true,
            create_time: "2026-03-21T00:00:00Z",
            update_time: "2026-03-21T00:00:00Z",
          },
        ]),
      );
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            warehouse_city: "New York",
            warehouse_address: "1 Dock Way",
            warehouse_contact: "Dock Lead",
            warehouse_manager: "Ops Manager",
            creator: "Route Tester",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/statistics"]);

  expect(await screen.findByRole("heading", { name: "Statistics" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Stock In&Out" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Standard Stock-in" })).toBeInTheDocument();
  expect(screen.getAllByText("Main WH").length).toBeGreaterThan(0);
});

test("renders B2B operations for authorized operators", async () => {
  saveStoredSession({
    username: "manager",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Manager"));
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            warehouse_city: "New York",
            warehouse_address: "1 Dock Way",
            warehouse_contact: "Dock Lead",
            warehouse_manager: "Ops Manager",
            creator: "Route Tester",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/purchase-orders/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            supplier_name: "Supplier A",
            po_number: "PO-B2B-1001",
            expected_arrival_date: "2026-03-20T08:00:00Z",
            status: "OPEN",
            reference_code: "",
            notes: "",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/advance-shipment-notices/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 2,
            purchase_order: 1,
            purchase_order_number: "PO-B2B-1001",
            warehouse: 1,
            warehouse_name: "Main WH",
            supplier_name: "Supplier A",
            asn_number: "ASN-B2B-1001",
            expected_arrival_date: "2026-03-20T09:00:00Z",
            status: "OPEN",
            notes: "",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/receipts/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 3,
            purchase_order: 1,
            purchase_order_number: "PO-B2B-1001",
            asn_number: "ASN-B2B-1001",
            warehouse: 1,
            warehouse_name: "Main WH",
            receipt_number: "RCPT-B2B-1001",
            receipt_location_code: "RCV-01",
            received_by: "Route Tester",
            received_at: "2026-03-20T10:00:00Z",
            status: "POSTED",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/signing-records/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 4,
            purchase_order: 1,
            purchase_order_number: "PO-B2B-1001",
            asn_number: "ASN-B2B-1001",
            signing_number: "SIGN-B2B-1001",
            carrier_name: "DHL",
            vehicle_plate: "粤B12345",
            signed_by: "Dock Lead",
            signed_at: "2026-03-20T08:30:00Z",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/putaway-tasks/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 5,
            warehouse: 1,
            warehouse_name: "Main WH",
            task_number: "PT-B2B-1001",
            goods_code: "SKU-B2B-1",
            from_location_code: "RCV-01",
            to_location_code: "A-01-01",
            status: "OPEN",
            assigned_to_name: "",
            completed_by: "",
            completed_at: null,
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/sales-orders/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 6,
            warehouse: 1,
            warehouse_name: "Main WH",
            customer: 99,
            customer_name: "Acme Retail",
            order_number: "SO-B2B-1001",
            requested_ship_date: "2026-03-21T08:00:00Z",
            status: "ALLOCATED",
            fulfillment_stage: "IN_PROCESS",
            exception_state: "NORMAL",
            package_count: 2,
            shipping_method: "Ground",
            tracking_number: "",
            waybill_printed: false,
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/pick-tasks/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 7,
            warehouse: 1,
            warehouse_name: "Main WH",
            sales_order: 6,
            order_number: "SO-B2B-1001",
            task_number: "PICK-B2B-1001",
            goods_code: "SKU-B2B-1",
            from_location_code: "A-01-01",
            to_location_code: "STAGE-01",
            requested_qty: "2.0000",
            picked_qty: "0.0000",
            status: "OPEN",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/package-executions/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 8,
            warehouse: 1,
            warehouse_name: "Main WH",
            sales_order: 6,
            order_number: "SO-B2B-1001",
            shipment: null,
            shipment_number: "",
            wave: null,
            wave_number: "",
            record_number: "RELABEL-B2B-1001",
            step_type: "RELABEL",
            execution_status: "SUCCESS",
            package_number: "PKG-B2B-1001",
            scan_code: "LBL-1001",
            weight: null,
            notes: "",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/shipments/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 9,
            warehouse: 1,
            warehouse_name: "Main WH",
            sales_order: 6,
            order_number: "SO-B2B-1001",
            shipment_number: "SHP-B2B-1001",
            staging_location_code: "STAGE-01",
            status: "OPEN",
            shipped_at: null,
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/outbound/waves/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 10,
            warehouse: 1,
            warehouse_name: "Main WH",
            wave_number: "WAVE-B2B-1001",
            status: "OPEN",
            order_count: 1,
            notes: "",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/b2b"]);

  expect(await screen.findByText("B2B operations")).toBeInTheDocument();
  expect(await screen.findByRole("link", { name: "PO-B2B-1001" })).toHaveAttribute("href", "/inbound/purchase-orders/1");
  expect(await screen.findByRole("link", { name: "SO-B2B-1001" })).toHaveAttribute("href", "/outbound/sales-orders/6");
  expect(screen.getByRole("link", { name: "Scan and Relabel" })).toHaveAttribute("href", "#scan-and-relabel");
});

test("renders inbound scan panels and inbound records for authorized operators", async () => {
  saveStoredSession({
    username: "inbound",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Inbound"));
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Inbound WH",
            warehouse_city: "New York",
            warehouse_address: "1 Dock Way",
            warehouse_contact: "Dock Lead",
            warehouse_manager: "Ops Manager",
            creator: "Route Tester",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/locations/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 15,
            warehouse: 1,
            warehouse_name: "Inbound WH",
            zone: 5,
            zone_code: "RCV",
            location_type: 2,
            location_type_code: "STAGE",
            location_code: "RCV-01",
            location_name: "Receiving Lane 01",
            aisle: "",
            bay: "",
            level: "",
            slot: "",
            barcode: "RCV-01",
            capacity_qty: "100.0000",
            max_weight: "1000.0000",
            max_volume: "100.0000",
            pick_sequence: 1,
            is_pick_face: false,
            is_locked: false,
            status: "ACTIVE",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/purchase-orders/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Inbound WH",
            supplier_name: "Supplier A",
            po_number: "PO-1001",
            expected_arrival_date: "2026-03-20T08:00:00Z",
            status: "OPEN",
            reference_code: "",
            notes: "",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inbound/receipts/" || url.pathname === "/api/inbound/putaway-tasks/") {
      return jsonResponse(buildPaginatedResponse([]));
    }
    return undefined;
  });

  renderWithRouter(["/inbound"]);

  expect(await screen.findByText("Stock-in operations", undefined, { timeout: 5000 })).toBeInTheDocument();
  expect((await screen.findAllByText("PO-1001", undefined, { timeout: 5000 })).length).toBeGreaterThan(0);
  expect(screen.getByText("Scan receive")).toBeInTheDocument();
  expect(screen.getByText("Scan putaway")).toBeInTheDocument();
  expect(screen.getAllByText("Supplier A").length).toBeGreaterThan(0);
});

test("renders transfers and replenishment for authorized operators", async () => {
  saveStoredSession({
    username: "stock",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("StockControl"));
    }
    if (url.pathname === "/api/warehouse/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 1,
            warehouse_name: "Main WH",
            warehouse_city: "New York",
            warehouse_address: "1 Dock Way",
            warehouse_contact: "Dock Lead",
            warehouse_manager: "Ops Manager",
            creator: "Route Tester",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/locations/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 20,
            warehouse: 1,
            warehouse_name: "Main WH",
            zone: 7,
            zone_code: "PICK",
            location_type: 2,
            location_type_code: "PICKFACE",
            location_code: "PICK-01",
            location_name: "Pick Face 01",
            aisle: "",
            bay: "",
            level: "",
            slot: "",
            barcode: "PICK-01",
            capacity_qty: "100.0000",
            max_weight: "1000.0000",
            max_volume: "100.0000",
            pick_sequence: 1,
            is_pick_face: true,
            is_locked: false,
            status: "ACTIVE",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/inventory/balances/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 90,
            warehouse: 1,
            warehouse_name: "Main WH",
            location: 10,
            location_code: "A-01-01",
            goods: 101,
            goods_code: "SKU-TRANS-1",
            stock_status: "AVAILABLE",
            lot_number: "",
            serial_number: "",
            on_hand_qty: "12.0000",
            allocated_qty: "0.0000",
            hold_qty: "0.0000",
            available_qty: "12.0000",
            unit_cost: "4.5000",
            currency: "USD",
            creator: "Route Tester",
            last_movement_at: "2026-03-14T10:00:00Z",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:15:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/transfers/transfer-orders/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 3,
            warehouse: 1,
            warehouse_name: "Main WH",
            transfer_number: "TR-1001",
            requested_date: "2026-03-20T08:00:00Z",
            reference_code: "",
            status: "OPEN",
            notes: "",
            lines: [],
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/transfers/transfer-lines/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 31,
            transfer_order: 3,
            line_number: 1,
            goods: 101,
            goods_code: "SKU-TRANS-1",
            from_location: 10,
            from_location_code: "A-01-01",
            to_location: 20,
            to_location_code: "B-01-01",
            requested_qty: "5.0000",
            moved_qty: "0.0000",
            stock_status: "AVAILABLE",
            lot_number: "",
            serial_number: "",
            status: "OPEN",
            assigned_to: null,
            assigned_to_name: "",
            completed_by: "",
            completed_at: null,
            inventory_movement: null,
            notes: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/transfers/replenishment-rules/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 9,
            warehouse: 1,
            warehouse_name: "Main WH",
            goods: 101,
            goods_code: "SKU-TRANS-1",
            source_location: 10,
            source_location_code: "A-01-01",
            target_location: 22,
            target_location_code: "PICK-01",
            minimum_qty: "2.0000",
            target_qty: "10.0000",
            stock_status: "AVAILABLE",
            priority: 100,
            is_active: true,
            notes: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/transfers/replenishment-tasks/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 12,
            replenishment_rule: 9,
            warehouse: 1,
            warehouse_name: "Main WH",
            source_balance: 90,
            goods: 101,
            goods_code: "SKU-TRANS-1",
            task_number: "RPL-1001",
            from_location: 10,
            from_location_code: "A-01-01",
            to_location: 22,
            to_location_code: "PICK-01",
            quantity: "8.0000",
            priority: 100,
            stock_status: "AVAILABLE",
            lot_number: "",
            serial_number: "",
            status: "OPEN",
            assigned_to: null,
            assigned_to_name: "",
            completed_by: "",
            completed_at: null,
            inventory_movement: null,
            notes: "",
            generated_at: "2026-03-14 10:00:00",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/transfers"]);

  expect(
    await screen.findByRole("heading", { name: "Transfers and replenishment" }, { timeout: 5000 }),
  ).toBeInTheDocument();
  expect(await screen.findByText("TR-1001")).toBeInTheDocument();
  expect((await screen.findAllByText("SKU-TRANS-1")).length).toBeGreaterThan(0);
  expect(await screen.findByText("RPL-1001")).toBeInTheDocument();
});

test("renders returns operations for authorized operators", async () => {
  saveStoredSession({
    username: "returns",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Inbound"));
    }
    if (url.pathname === "/api/returns/return-orders/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 4,
            warehouse: 1,
            warehouse_name: "Main WH",
            customer: 22,
            customer_name: "Customer A",
            sales_order: 41,
            sales_order_number: "SO-1001",
            return_number: "RTN-1001",
            requested_date: "2026-03-21T08:00:00Z",
            reference_code: "",
            status: "OPEN",
            notes: "",
            lines: [],
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/returns/receipts/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 18,
            return_line: 401,
            return_number: "RTN-1001",
            line_number: 1,
            goods_code: "SKU-RET-1",
            warehouse: 1,
            warehouse_name: "Main WH",
            receipt_location: 33,
            receipt_location_code: "RET-01",
            receipt_number: "RTR-1001",
            received_qty: "2.0000",
            stock_status: "AVAILABLE",
            lot_number: "",
            serial_number: "",
            notes: "",
            received_by: "Route Tester",
            received_at: "2026-03-14 10:00:00",
            inventory_movement: 501,
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/returns/dispositions/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 19,
            return_receipt: 18,
            return_number: "RTN-1001",
            receipt_number: "RTR-1001",
            goods_code: "SKU-RET-1",
            warehouse: 1,
            disposition_number: "RTD-1001",
            disposition_type: "RESTOCK",
            quantity: "2.0000",
            to_location: 44,
            to_location_code: "A-01-01",
            notes: "",
            completed_by: "Route Tester",
            completed_at: "2026-03-14 10:15:00",
            inventory_movement: 502,
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/returns"]);

  expect(await screen.findByText("Returns operations")).toBeInTheDocument();
  expect(screen.getByText("Record return receipt")).toBeInTheDocument();
  expect((await screen.findAllByText("RTN-1001")).length).toBeGreaterThan(0);
  expect(await screen.findByText("RTD-1001")).toBeInTheDocument();
});

test("renders transfer order detail routes for authorized operators", async () => {
  saveStoredSession({
    username: "stock",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("StockControl"));
    }
    if (url.pathname === "/api/transfers/transfer-orders/3/") {
      return jsonResponse({
        id: 3,
        warehouse: 1,
        warehouse_name: "Main WH",
        transfer_number: "TR-DETAIL-1001",
        requested_date: "2026-03-20T08:00:00Z",
        reference_code: "XFER-REF-1",
        status: "OPEN",
        notes: "Move reserve stock to pick face",
        lines: [
          {
            id: 31,
            transfer_order: 3,
            line_number: 1,
            goods: 101,
            goods_code: "SKU-TRANS-DETAIL-1",
            from_location: 10,
            from_location_code: "A-01-01",
            to_location: 20,
            to_location_code: "PICK-01",
            requested_qty: "5.0000",
            moved_qty: "0.0000",
            stock_status: "AVAILABLE",
            lot_number: "",
            serial_number: "",
            status: "OPEN",
            assigned_to: null,
            assigned_to_name: "",
            completed_by: "",
            completed_at: null,
            inventory_movement: null,
            notes: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ],
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    return undefined;
  });

  renderWithRouter(["/transfers/transfer-orders/3"]);

  expect(await screen.findByText("Transfer order detail")).toBeInTheDocument();
  expect(await screen.findByText("TR-DETAIL-1001")).toBeInTheDocument();
  expect(await screen.findByText("SKU-TRANS-DETAIL-1")).toBeInTheDocument();
  expect(screen.getByText("PICK-01")).toBeInTheDocument();
});

test("renders return order detail routes for authorized operators", async () => {
  saveStoredSession({
    username: "returns",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Inbound"));
    }
    if (url.pathname === "/api/returns/return-orders/4/") {
      return jsonResponse({
        id: 4,
        warehouse: 1,
        warehouse_name: "Main WH",
        customer: 22,
        customer_name: "Customer A",
        sales_order: 41,
        sales_order_number: "SO-DETAIL-1001",
        return_number: "RTN-DETAIL-1001",
        requested_date: "2026-03-21T08:00:00Z",
        reference_code: "RET-REF-1",
        status: "OPEN",
        notes: "Inspect before restock",
        lines: [
          {
            id: 401,
            line_number: 1,
            goods: 501,
            goods_code: "SKU-RET-DETAIL-1",
            expected_qty: "3.0000",
            received_qty: "1.0000",
            disposed_qty: "0.0000",
            status: "PARTIAL_RECEIVED",
            return_reason: "DAMAGED_PACKAGING",
            notes: "",
          },
        ],
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    return undefined;
  });

  renderWithRouter(["/returns/return-orders/4"]);

  expect(await screen.findByText("Return order detail")).toBeInTheDocument();
  expect(await screen.findByText("RTN-DETAIL-1001")).toBeInTheDocument();
  expect(await screen.findByText("SKU-RET-DETAIL-1")).toBeInTheDocument();
  expect(screen.getByText("DAMAGED_PACKAGING")).toBeInTheDocument();
});

test("renders scheduled task detail routes for automation operators", async () => {
  saveStoredSession({
    username: "automation",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("StockControl"));
    }
    if (url.pathname === "/api/automation/scheduled-tasks/7/") {
      return jsonResponse({
        id: 7,
        warehouse: 1,
        customer: 22,
        name: "Nightly billing export",
        task_type: "REPORT_EXPORT",
        interval_minutes: 60,
        next_run_at: "2026-03-20T08:00:00Z",
        priority: 50,
        max_attempts: 5,
        is_active: true,
        payload: { report: "aging", format: "csv" },
        last_enqueued_at: "2026-03-19T23:00:00Z",
        last_completed_at: "2026-03-19T23:05:00Z",
        last_error: "",
        notes: "Runs every hour overnight",
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    if (url.pathname === "/api/automation/background-tasks/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 14,
            scheduled_task: 7,
            warehouse: 1,
            customer: 22,
            integration_job: null,
            report_export: 91,
            invoice: null,
            task_type: "REPORT_EXPORT",
            status: "COMPLETED",
            priority: 50,
            available_at: "2026-03-19T23:00:00Z",
            started_at: "2026-03-19T23:00:03Z",
            completed_at: "2026-03-19T23:05:00Z",
            attempt_count: 1,
            max_attempts: 5,
            retry_backoff_seconds: 300,
            locked_by: "worker-1",
            reference_code: "AUTO-14",
            payload: { report: "aging" },
            result_summary: { rows: 42 },
            last_error: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    if (url.pathname === "/api/automation/alerts/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 21,
            warehouse: 1,
            scheduled_task: 7,
            background_task: null,
            alert_type: "RETRY_BACKLOG",
            severity: "MEDIUM",
            status: "OPEN",
            alert_key: "sched-7-retry",
            summary: "Retry backlog is rising",
            payload: { queued: 3 },
            opened_at: "2026-03-19T22:30:00Z",
            resolved_at: null,
            resolved_by: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/automation/scheduled-tasks/7"]);

  expect(await screen.findByText("Scheduled task detail")).toBeInTheDocument();
  expect(await screen.findByText("Nightly billing export")).toBeInTheDocument();
  expect(await screen.findByText("AUTO-14")).toBeInTheDocument();
  expect(await screen.findByText("Retry backlog is rising")).toBeInTheDocument();
});

test("renders background task detail routes for automation operators", async () => {
  saveStoredSession({
    username: "automation",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("StockControl"));
    }
    if (url.pathname === "/api/automation/background-tasks/14/") {
      return jsonResponse({
        id: 14,
        scheduled_task: 7,
        warehouse: 1,
        customer: 22,
        integration_job: 5,
        report_export: 91,
        invoice: null,
        task_type: "REPORT_EXPORT",
        status: "RETRY",
        priority: 50,
        available_at: "2026-03-19T23:00:00Z",
        started_at: "2026-03-19T23:00:03Z",
        completed_at: null,
        attempt_count: 2,
        max_attempts: 5,
        retry_backoff_seconds: 300,
        locked_by: "worker-1",
        reference_code: "AUTO-14",
        payload: { report: "aging" },
        result_summary: { rows: 0 },
        last_error: "carrier unavailable",
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    if (url.pathname === "/api/automation/alerts/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 31,
            warehouse: 1,
            scheduled_task: 7,
            background_task: 14,
            alert_type: "DEAD_TASK",
            severity: "HIGH",
            status: "OPEN",
            alert_key: "task-14-dead",
            summary: "Task requires manual retry",
            payload: { attempts: 2 },
            opened_at: "2026-03-19T23:10:00Z",
            resolved_at: null,
            resolved_by: "",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/automation/background-tasks/14"]);

  expect(await screen.findByText("Background task detail")).toBeInTheDocument();
  expect(await screen.findByText("AUTO-14")).toBeInTheDocument();
  expect(await screen.findByText("carrier unavailable")).toBeInTheDocument();
  expect(await screen.findByText("Task requires manual retry")).toBeInTheDocument();
});

test("renders integration job detail routes for integration operators", async () => {
  saveStoredSession({
    username: "integrations",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Supervisor"));
    }
    if (url.pathname === "/api/integrations/jobs/5/") {
      return jsonResponse({
        id: 5,
        warehouse: 1,
        source_webhook: 12,
        system_type: "ERP",
        integration_name: "NetSuite",
        job_type: "ORDER_EXPORT",
        direction: "OUTBOUND",
        status: "RUNNING",
        reference_code: "ERP-5001",
        external_reference: "SO-1001",
        request_payload: { order_number: "SO-1001" },
        response_payload: { accepted: true },
        started_at: "2026-03-20T08:00:00Z",
        completed_at: null,
        attempt_count: 1,
        triggered_by: "Route Tester",
        last_error: "",
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    if (url.pathname === "/api/integrations/logs/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 77,
            job: 5,
            webhook_event: null,
            level: "INFO",
            message: "Export payload accepted",
            payload: { accepted: true },
            logged_at: "2026-03-20T08:00:05Z",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/integrations/jobs/5"]);

  expect(await screen.findByText("Integration job detail")).toBeInTheDocument();
  expect(await screen.findByText("ERP-5001")).toBeInTheDocument();
  expect(await screen.findByText("NetSuite")).toBeInTheDocument();
  expect(await screen.findByText("Export payload accepted")).toBeInTheDocument();
});

test("renders webhook event detail routes for integration operators", async () => {
  saveStoredSession({
    username: "integrations",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Supervisor"));
    }
    if (url.pathname === "/api/integrations/webhooks/12/") {
      return jsonResponse({
        id: 12,
        warehouse: 1,
        system_type: "WEBHOOK",
        source_system: "carrier-cloud",
        event_type: "shipment.confirmed",
        event_key: "evt-12",
        signature: "sig-12",
        headers: { "x-signature": "sig-12" },
        payload: { shipment_number: "SHP-1" },
        reference_code: "WH-12",
        status: "FAILED",
        received_at: "2026-03-20T07:55:00Z",
        processed_at: null,
        last_error: "payload malformed",
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    if (url.pathname === "/api/integrations/logs/") {
      return jsonResponse(
        buildPaginatedResponse([
          {
            id: 88,
            job: null,
            webhook_event: 12,
            level: "ERROR",
            message: "Signature verified but payload malformed",
            payload: { field: "shipment_number" },
            logged_at: "2026-03-20T07:56:00Z",
            creator: "Route Tester",
            openid: "tenant-openid",
            create_time: "2026-03-14 09:00:00",
            update_time: "2026-03-14 09:00:00",
          },
        ]),
      );
    }
    return undefined;
  });

  renderWithRouter(["/integrations/webhooks/12"]);

  expect(await screen.findByText("Webhook event detail")).toBeInTheDocument();
  expect(await screen.findByText("evt-12")).toBeInTheDocument();
  expect(await screen.findByText("payload malformed")).toBeInTheDocument();
  expect(await screen.findByText("Signature verified but payload malformed")).toBeInTheDocument();
});

test("renders carrier booking detail routes for integration operators", async () => {
  saveStoredSession({
    username: "integrations",
    openid: "tenant-openid",
    operatorId: 11,
    operatorName: "",
    operatorRole: "",
  });

  installFetchMock((url) => {
    if (url.pathname === "/api/staff/11/") {
      return jsonResponse(buildStaffRecord("Supervisor"));
    }
    if (url.pathname === "/api/integrations/carrier-bookings/9/") {
      return jsonResponse({
        id: 9,
        warehouse: 1,
        shipment: 4,
        booking_job: 5,
        label_job: 6,
        booking_number: "CB-1001",
        carrier_code: "UPS",
        service_level: "GROUND",
        package_count: 3,
        total_weight: "12.5000",
        status: "BOOKED",
        tracking_number: "1Z999",
        label_format: "PDF",
        label_document: "label.pdf",
        external_reference: "SO-1001",
        request_payload: { packages: 3 },
        response_payload: { booking_id: "ups-1" },
        booked_by: "Route Tester",
        booked_at: "2026-03-20T08:30:00Z",
        labeled_at: null,
        last_error: "",
        creator: "Route Tester",
        openid: "tenant-openid",
        create_time: "2026-03-14 09:00:00",
        update_time: "2026-03-14 09:00:00",
      });
    }
    return undefined;
  });

  renderWithRouter(["/integrations/carrier-bookings/9"]);

  expect(await screen.findByText("Carrier booking detail")).toBeInTheDocument();
  expect(await screen.findByText("CB-1001")).toBeInTheDocument();
  expect(await screen.findByText("UPS")).toBeInTheDocument();
  expect(await screen.findByText("label.pdf")).toBeInTheDocument();
});
