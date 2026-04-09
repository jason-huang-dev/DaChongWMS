import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";

import { renderWithProviders } from "@/test/render";
import { InventoryMovementsPage } from "@/features/inventory/view/InventoryMovementsPage";
import type { InventoryMovementHistoryListResponse } from "@/features/inventory/model/types";

const apiGetMock = vi.fn();

vi.mock("@/app/scope-context", () => ({
  useTenantScope: () => ({
    company: { id: 1, openid: "tenant-openid" },
    activeWarehouseId: 7,
  }),
}));

vi.mock("@/lib/http", async () => {
  const actual = await vi.importActual<typeof import("@/lib/http")>("@/lib/http");
  return {
    ...actual,
    apiGet: (...args: Parameters<typeof actual.apiGet>) => apiGetMock(...args),
  };
});

const movementHistoryResponse: InventoryMovementHistoryListResponse = {
  count: 1,
  next: null,
  previous: null,
  results: [
    {
      id: 101,
      warehouseId: 7,
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
  ],
  filterOptions: {
    warehouses: [{ value: "7", label: "Main WH" }],
    movementTypes: [{ value: "RECEIPT", label: "Receipt" }],
  },
};

describe("InventoryMovementsPage", () => {
  beforeEach(() => {
    apiGetMock.mockReset();
    apiGetMock.mockResolvedValue(movementHistoryResponse);
  });

  test("renders backend-driven inventory movement history", async () => {
    renderWithProviders(<InventoryMovementsPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByText("Scanner")).toBeInTheDocument();
    expect(screen.getByText(/Main WH/)).toBeInTheDocument();
    expect(screen.getByText("Standard Stock-in")).toBeInTheDocument();
    expect(screen.getAllByText("RCPT-2001")).toHaveLength(2);
    expect(screen.getByText(/PO-2001/)).toBeInTheDocument();
    expect(screen.getAllByText("R5ZG260402210815")).toHaveLength(2);
    expect(screen.getByText("PT-RCPT-2001-1")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Warehouses" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Movement Types" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Merchant SKU" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Location" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Performed By" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Reference" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Search all text" })).toBeInTheDocument();
    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/v1/organizations/1/inventory/movements/",
      expect.objectContaining({
        page: 1,
        page_size: 15,
        sortKey: "occurredAt",
        sortDirection: "desc",
        warehouse_id: 7,
      }),
    );
  });

  test("uses the standard sticky-table page chrome collapse interaction", async () => {
    renderWithProviders(<InventoryMovementsPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByTestId("inventory-movements-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByTestId("inventory-movements-page-chrome")).toHaveAttribute("data-collapse-progress", "0.00");

    const tableScrollRegion = screen.getByRole("table").parentElement;
    expect(tableScrollRegion).not.toBeNull();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 80 } });

    await waitFor(() => {
      expect(Number(screen.getByTestId("inventory-movements-page-chrome").getAttribute("data-collapse-progress"))).toBeGreaterThan(0);
    });

    expect(screen.getByTestId("inventory-movements-page-chrome")).toHaveAttribute("aria-hidden", "false");
    expect(screen.getByRole("textbox", { name: "Search all text" })).toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 220 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-movements-page-chrome")).toHaveAttribute("aria-hidden", "true");
    });

    expect(screen.queryByRole("textbox", { name: "Search all text" })).not.toBeInTheDocument();

    fireEvent.scroll(tableScrollRegion!, { target: { scrollTop: 0 } });

    await waitFor(() => {
      expect(screen.getByTestId("inventory-movements-page-chrome")).toHaveAttribute("aria-hidden", "false");
    });
  });
});
