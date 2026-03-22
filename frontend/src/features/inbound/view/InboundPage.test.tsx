import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { InboundPage } from "@/features/inbound/view/InboundPage";
import { renderWithProviders } from "@/test/render";

const mockUseInboundController = vi.fn();

vi.mock("@/features/inbound/controller/useInboundController", () => ({
  useInboundController: () => mockUseInboundController(),
}));

vi.mock("@/features/inbound/view/components/CreateReceiptPanel", () => ({
  CreateReceiptPanel: () => <div>Create receipt panel</div>,
}));

vi.mock("@/features/inbound/view/components/ScanSignPanel", () => ({
  ScanSignPanel: () => <div>Scan sign panel</div>,
}));

vi.mock("@/features/inbound/view/components/ScanReceivePanel", () => ({
  ScanReceivePanel: () => <div>Scan receive panel</div>,
}));

vi.mock("@/features/inbound/view/components/ScanPutawayPanel", () => ({
  ScanPutawayPanel: () => <div>Scan putaway panel</div>,
}));

vi.mock("@/features/inbound/view/components/StockInImportPanel", () => ({
  StockInImportPanel: () => <div>Stock-in import panel</div>,
}));

const emptyView = {
  activeFilterCount: 0,
  applySavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  filters: {},
  page: 1,
  pageSize: 8,
  resetFilters: vi.fn(),
  saveCurrentView: vi.fn(),
  savedViews: [],
  selectedSavedViewId: null,
  setPage: vi.fn(),
  updateFilter: vi.fn(),
};

beforeEach(() => {
  mockUseInboundController.mockReset();
});

test("renders the stock-in workbench sections for scans, imports, returns, and records", () => {
  mockUseInboundController.mockReturnValue({
    activeWarehouse: {
      id: 1,
      warehouse_name: "Main Warehouse",
      warehouse_city: "Shenzhen",
      warehouse_address: "1 Warehouse Road",
      warehouse_contact: "Ops Desk",
      warehouse_manager: "Alice",
      creator: "Seeder",
      create_time: "2026-03-20 09:00:00",
      update_time: "2026-03-20 09:00:00",
    },
    advanceShipmentNoticesQuery: { data: { count: 1, results: [] }, isLoading: false, error: null },
    advanceShipmentNoticesView: emptyView,
    createReceiptMutation: { isPending: false, mutateAsync: vi.fn() },
    importBatchErrorMessage: null,
    importBatchMutation: { isPending: false, mutateAsync: vi.fn() },
    importBatchSuccessMessage: null,
    importBatchesQuery: { data: { count: 0, results: [] }, isLoading: false, error: null },
    importBatchesView: emptyView,
    overduePurchaseOrdersQuery: { data: { count: 0, results: [] }, isLoading: false, error: null },
    purchaseOrdersQuery: { data: { count: 2, results: [] }, isLoading: false, error: null },
    purchaseOrdersView: emptyView,
    putawayTasksQuery: { data: { count: 3, results: [] }, isLoading: false, error: null },
    putawayTasksView: emptyView,
    receiptErrorMessage: null,
    receiptSuccessMessage: null,
    receiptsQuery: { data: { count: 4, results: [] }, isLoading: false, error: null },
    receiptsView: emptyView,
    returnOrdersQuery: { data: { count: 2, results: [] }, isLoading: false, error: null },
    returnOrdersView: emptyView,
    returnReceiptsQuery: { data: { count: 1, results: [] }, isLoading: false, error: null },
    signingRecordsQuery: { data: { count: 1, results: [] }, isLoading: false, error: null },
    signingRecordsView: emptyView,
  });

  renderWithProviders(
    <MemoryRouter>
      <InboundPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("Stock-in operations")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Standard Stock-in" })).toHaveAttribute("href", "#standard-stock-in");
  expect(screen.getByRole("heading", { name: "Stock-in List Management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Scan to Sign" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Scan to Receive" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Scan to List" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Import to Stock-in" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Import Management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Returns to Stock In" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Return order management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stock-in Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Signing Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Receiving Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Listing Record" })).toBeInTheDocument();
});
