import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

import type { InventoryInformationRow } from "@/features/inventory/model/types";
import { InventoryLabelPrintDialog } from "@/features/inventory/view/InventoryLabelPrintDialog";
import { renderWithProviders } from "@/test/render";

class MockJsPdf {
  addPage = vi.fn();
  getTextWidth = vi.fn((value: string) => value.length);
  output = vi.fn(() => new Blob(["pdf"], { type: "application/pdf" }));
  rect = vi.fn();
  roundedRect = vi.fn();
  setDrawColor = vi.fn();
  setFillColor = vi.fn();
  setFont = vi.fn();
  setFontSize = vi.fn();
  setLineWidth = vi.fn();
  setTextColor = vi.fn();
  splitTextToSize = vi.fn((value: string) => [value]);
  text = vi.fn();
}

vi.mock("jspdf", () => ({
  jsPDF: MockJsPdf,
}));

const inventoryRow: InventoryInformationRow = {
  id: "live:7:SKU-001",
  merchantSku: "SKU-001",
  productName: "Scanner",
  productBarcode: "BC-001",
  productCategory: "Electronics",
  productBrand: "DaChong",
  productDescription: "Wireless barcode scanner",
  productTags: ["Hardware"],
  clients: [{ code: "RTL-1", name: "Retail Client", label: "RTL-1 Retail Client" }],
  shelf: "A-01-01",
  shelves: ["A-01-01"],
  inTransit: 0,
  pendingReceival: 0,
  toList: 0,
  orderAllocated: 0,
  availableStock: 9,
  defectiveProducts: 0,
  totalInventory: 9,
  listingTime: "2026-04-02T12:00:00Z",
  actualLength: "10",
  actualWidth: "8",
  actualHeight: "6",
  actualWeight: "2",
  measurementUnit: "cm",
  merchantCode: "M-001",
  customerCode: "C-001",
  warehouseName: "Main WH",
  stockStatus: "AVAILABLE",
  stockStatuses: ["AVAILABLE"],
  zoneCode: "A",
  zoneCodes: ["A"],
  locationTypeCode: "BIN",
  locationTypeCodes: ["BIN"],
  areaKey: "storage",
  areaLabel: "Storage",
  source: "live",
};

describe("InventoryLabelPrintDialog", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test("opens the generated label PDF in a new tab when the initial preview window is blocked", async () => {
    const user = userEvent.setup();
    const fallbackWindow = {
      closed: false,
      focus: vi.fn(),
      location: { replace: vi.fn() },
    } as unknown as Window;
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:inventory-labels"),
      writable: true,
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
      writable: true,
    });
    const openMock = vi
      .spyOn(window, "open")
      .mockImplementationOnce(() => null)
      .mockImplementationOnce(() => fallbackWindow);
    const createObjectUrlMock = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:inventory-labels");
    const revokeObjectUrlMock = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});

    renderWithProviders(<InventoryLabelPrintDialog onClose={vi.fn()} open rows={[inventoryRow]} />);

    await user.click(screen.getByRole("button", { name: "Print" }));

    await waitFor(() => {
      expect(openMock).toHaveBeenNthCalledWith(1, "", "_blank", "noopener,noreferrer");
      expect(openMock).toHaveBeenNthCalledWith(2, "blob:inventory-labels", "_blank", "noopener,noreferrer");
    });

    expect(fallbackWindow.focus).toHaveBeenCalledTimes(1);
    expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrlMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Allow pop-ups to preview the label PDF in a new tab.")).not.toBeInTheDocument();
  });
});
