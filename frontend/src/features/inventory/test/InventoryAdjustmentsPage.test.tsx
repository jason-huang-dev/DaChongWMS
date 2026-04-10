import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { InventoryAdjustmentsPage } from "@/features/inventory/view/InventoryAdjustmentsPage";
import type { InventoryMovementHistoryListResponse } from "@/features/inventory/model/types";
import { renderWithProviders } from "@/test/render";

const apiGetMock = vi.fn();
const apiPostMock = vi.fn();
const setActiveWarehouseIdMock = vi.fn();

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => ({
    company: { id: 1, openid: "tenant-openid" },
    activeWarehouseId: 7,
    setActiveWarehouseId: setActiveWarehouseIdMock,
    warehouses: [
      { id: 7, warehouse_name: "NJ" },
      { id: 8, warehouse_name: "LA" },
    ],
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

const movementHistoryResponse: InventoryMovementHistoryListResponse = {
  count: 3,
  next: null,
  previous: null,
  results: [
    {
      id: 301,
      warehouseId: 7,
      warehouseName: "NJ",
      productId: 88,
      merchantSku: "5ZG00112",
      productName: "03-CSKJ-5124-BLACK-46",
      productBarcode: "BC-001",
      clientCode: "",
      clientName: "",
      movementType: "ADJUSTMENT_OUT",
      movementTypeLabel: "Adjustment Out",
      entryTypeLabel: "",
      stockStatus: "AVAILABLE",
      quantity: 1,
      fromLocationCode: "01",
      toLocationCode: "",
      referenceCode: "AD5ZG110658",
      sourceDocumentNumber: "",
      linkedDocumentNumbers: [],
      sourceDocumentNumbers: [],
      purchaseOrderNumber: "",
      receiptNumber: "",
      asnNumber: "",
      batchNumber: "LOT-001",
      serialNumber: "",
      shelfCode: "01",
      quantityBeforeChange: 8,
      remainingBatchQuantity: 7,
      reason: "Recount variance",
      performedBy: "Fujian Linsen Media",
      occurredAt: "2026-04-09T05:43:12Z",
      resultingFromQty: 7,
      resultingToQty: null,
      resultingQuantity: 7,
      resultingLocationCode: "01",
    },
    {
      id: 302,
      warehouseId: 7,
      warehouseName: "NJ",
      productId: 89,
      merchantSku: "5ZG00304",
      productName: "QIC-MLQ528-130",
      productBarcode: "BC-002",
      clientCode: "",
      clientName: "",
      movementType: "ADJUSTMENT_OUT",
      movementTypeLabel: "Adjustment Out",
      entryTypeLabel: "",
      stockStatus: "AVAILABLE",
      quantity: 2,
      fromLocationCode: "01",
      toLocationCode: "",
      referenceCode: "AD5ZG110658",
      sourceDocumentNumber: "",
      linkedDocumentNumbers: [],
      sourceDocumentNumbers: [],
      purchaseOrderNumber: "",
      receiptNumber: "",
      asnNumber: "",
      batchNumber: "LOT-002",
      serialNumber: "",
      shelfCode: "01",
      quantityBeforeChange: 3,
      remainingBatchQuantity: 1,
      reason: "Recount variance",
      performedBy: "Fujian Linsen Media",
      occurredAt: "2026-04-09T05:43:12Z",
      resultingFromQty: 1,
      resultingToQty: null,
      resultingQuantity: 1,
      resultingLocationCode: "01",
    },
    {
      id: 303,
      warehouseId: 7,
      warehouseName: "NJ",
      productId: 90,
      merchantSku: "5ZG00543",
      productName: "kongbao",
      productBarcode: "BC-003",
      clientCode: "",
      clientName: "",
      movementType: "ADJUSTMENT_IN",
      movementTypeLabel: "Adjustment In",
      entryTypeLabel: "",
      stockStatus: "AVAILABLE",
      quantity: 200,
      fromLocationCode: "",
      toLocationCode: "01",
      referenceCode: "AD5ZG110657",
      sourceDocumentNumber: "",
      linkedDocumentNumbers: [],
      sourceDocumentNumbers: [],
      purchaseOrderNumber: "",
      receiptNumber: "",
      asnNumber: "",
      batchNumber: "",
      serialNumber: "",
      shelfCode: "01",
      quantityBeforeChange: null,
      remainingBatchQuantity: 200,
      reason: "",
      performedBy: "Fujian Linsen Media",
      occurredAt: "2026-04-09T06:02:39Z",
      resultingFromQty: null,
      resultingToQty: 200,
      resultingQuantity: 200,
      resultingLocationCode: "01",
    },
  ],
  filterOptions: {
    warehouses: [{ value: "7", label: "NJ" }],
    movementTypes: [
      { value: "ADJUSTMENT_IN", label: "Adjustment In" },
      { value: "ADJUSTMENT_OUT", label: "Adjustment Out" },
    ],
  },
};

const inventoryBalanceReferenceResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 11,
      warehouse: 7,
      warehouse_name: "NJ",
      location: 21,
      location_code: "01",
      goods: 90,
      goods_code: "5ZG00543",
      stock_status: "AVAILABLE",
      lot_number: "",
      serial_number: "",
      on_hand_qty: "200",
      allocated_qty: "0",
      hold_qty: "0",
      available_qty: "200",
      unit_cost: "1.25",
      currency: "USD",
      creator: "manager@example.com",
      last_movement_at: "2026-04-09T06:02:39Z",
      create_time: "2026-04-09T06:02:39Z",
      update_time: "2026-04-09T06:02:39Z",
    },
  ],
};

describe("InventoryAdjustmentsPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiPostMock.mockReset();
    setActiveWarehouseIdMock.mockReset();
    apiGetMock.mockImplementation((path: string) => {
      if (path === "/api/v1/organizations/1/inventory/movements/") {
        return Promise.resolve(movementHistoryResponse);
      }

      if (path === "/api/inventory/balances/") {
        return Promise.resolve(inventoryBalanceReferenceResponse);
      }

      return Promise.reject(new Error(`Unhandled GET ${path}`));
    });
  });

  test("renders grouped adjustment rows and opens the create dialog", async () => {
    const user = userEvent.setup();

    renderWithProviders(<InventoryAdjustmentsPage />);

    expect(await screen.findByText("Create Adjustment List")).toBeInTheDocument();
    expect(await screen.findByText("5ZG00112")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Warehouse" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment type" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment search field" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Adjustment search text" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Adjustment match mode" })).toBeInTheDocument();
    expect(screen.getAllByText("AD5ZG110658").length).toBeGreaterThan(0);
    expect(screen.getAllByText("AD5ZG110657").length).toBeGreaterThan(0);
    expect(screen.getByText("5ZG00112")).toBeInTheDocument();
    expect(screen.getByText("5ZG00304")).toBeInTheDocument();
    expect(screen.getByText("5ZG00543")).toBeInTheDocument();
    expect(screen.getAllByText("NJ").length).toBeGreaterThan(0);
    expect(screen.getByText("-1")).toBeInTheDocument();
    expect(screen.getByText("-2")).toBeInTheDocument();
    expect(screen.getByText("+200")).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/organizations/1/inventory/movements/",
      expect.objectContaining({
        movementTypes: "[\"ADJUSTMENT_IN\",\"ADJUSTMENT_OUT\"]",
        page: 1,
        page_size: 200,
        sortDirection: "desc",
        sortKey: "occurredAt",
        warehouse_id: 7,
      }),
    );

    await user.click(screen.getByRole("button", { name: "Create Adjustment List" }));

    expect(await screen.findByRole("heading", { name: "Create inventory adjustment" })).toBeInTheDocument();
    expect(screen.getByLabelText("Inventory position")).toBeInTheDocument();
  });

  test("keeps the table toolbar visible while the filter chrome collapses on scroll", async () => {
    renderWithProviders(<InventoryAdjustmentsPage />);

    expect(await screen.findByText("Create Adjustment List")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-adjustments-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("inventory-adjustments-page-chrome")).toHaveAttribute("data-collapse-progress", "0.00");

    const tableScrollRegion = screen.getByRole("table").parentElement;
    expect(tableScrollRegion).not.toBeNull();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 80 } });

    await waitFor(() => {
      expect(Number(screen.getByTestId("inventory-adjustments-page-chrome").getAttribute("data-collapse-progress"))).toBeGreaterThan(0);
    });

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 220 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-adjustments-page-chrome")).toHaveAttribute("aria-hidden", "true");
    });

    expect(screen.getByRole("button", { name: "Create Adjustment List" })).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Adjustment search text" })).not.toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-adjustments-page-chrome")).toHaveAttribute("aria-hidden", "false");
    });
  });
});
