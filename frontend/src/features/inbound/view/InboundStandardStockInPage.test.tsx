import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { InboundStandardStockInPage } from "@/features/inbound/view/InboundStandardStockInPage";
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

const emptyView = {
  activeFilterCount: 0,
  applySavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  filters: {
    po_number__icontains: "",
    status: "",
    status__in: "",
    searchField: "",
    searchValue: "",
    dateField: "",
    dateFrom: "",
    dateTo: "",
  },
  page: 1,
  pageSize: 8,
  queryFilters: {},
  resetFilters: vi.fn(),
  saveCurrentView: vi.fn(),
  savedViews: [],
  selectedSavedViewId: null,
  setPage: vi.fn(),
  updateFilter: vi.fn(),
};

beforeEach(() => {
  mockUseInboundController.mockReset();
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
    createReceiptMutation: { isPending: false, mutateAsync: vi.fn() },
    overduePurchaseOrdersQuery: { data: { count: 0, results: [] }, isLoading: false, error: null },
    purchaseOrdersQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            po_number: "PO-1001",
            warehouse_name: "Main Warehouse",
            supplier_name: "Supplier A",
            expected_arrival_date: "2026-03-20T08:00:00Z",
            status: "OPEN",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    purchaseOrdersView: emptyView,
    putawayTasksQuery: { data: { count: 3, results: [] }, isLoading: false, error: null },
    receiptErrorMessage: null,
    receiptSuccessMessage: null,
  });
});

test("switches between standard stock-in subpages with tabs", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <MemoryRouter initialEntries={["/inbound/standard-stock-in"]}>
      <InboundStandardStockInPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole("tab", { name: "Stock-in List Management" })).toBeInTheDocument();
  expect(screen.getByTestId("stock-in-list-page-chrome")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Create receipt" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "PO-1001" })).toHaveAttribute("href", "/inbound/purchase-orders/1");

  await user.click(screen.getByRole("button", { name: "Create receipt" }));

  expect(screen.getByText("Create receipt panel")).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "Scan to Receive" }));

  expect(screen.getByText("Scan receive panel")).toBeInTheDocument();
  expect(screen.queryByText("Create receipt panel")).not.toBeInTheDocument();
});
