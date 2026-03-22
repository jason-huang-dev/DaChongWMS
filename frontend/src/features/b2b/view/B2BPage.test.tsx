import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { B2BPage } from "@/features/b2b/view/B2BPage";
import { renderWithProviders } from "@/test/render";

const mockUseInboundController = vi.fn();
const mockUseOutboundController = vi.fn();

vi.mock("@/features/inbound/controller/useInboundController", () => ({
  useInboundController: (options?: unknown) => mockUseInboundController(options),
}));

vi.mock("@/features/outbound/controller/useOutboundController", () => ({
  useOutboundController: (options?: unknown) => mockUseOutboundController(options),
}));

vi.mock("@/features/inbound/view/components/ScanReceivePanel", () => ({
  ScanReceivePanel: ({ orderType }: { orderType?: string }) => <div>Scan receive panel {orderType}</div>,
}));

vi.mock("@/features/inbound/view/components/ScanPutawayPanel", () => ({
  ScanPutawayPanel: ({ orderType }: { orderType?: string }) => <div>Scan putaway panel {orderType}</div>,
}));

vi.mock("@/features/outbound/view/components/PackageExecutionPanel", () => ({
  PackageExecutionPanel: ({ title, orderType }: { title: string; orderType?: string }) => <div>{title} {orderType}</div>,
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
  mockUseOutboundController.mockReset();
});

test("renders the B2B workbench sections for stock-in, stock-out, scan actions, and records", () => {
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
    purchaseOrdersQuery: { data: { count: 2, results: [] }, isLoading: false, error: null },
    purchaseOrdersView: emptyView,
    putawayTasksQuery: { data: { count: 3, results: [] }, isLoading: false, error: null },
    putawayTasksView: emptyView,
    receiptsQuery: { data: { count: 4, results: [] }, isLoading: false, error: null },
    receiptsView: emptyView,
    signingRecordsQuery: { data: { count: 1, results: [] }, isLoading: false, error: null },
    signingRecordsView: emptyView,
  });

  mockUseOutboundController.mockReturnValue({
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
    packageExecutionsQuery: { data: { count: 5, results: [] }, isLoading: false, error: null },
    pickTasksQuery: { data: { count: 2, results: [] }, isLoading: false, error: null },
    salesOrdersQuery: { data: { count: 6, results: [] }, isLoading: false, error: null },
    salesOrdersView: emptyView,
    salesOrderStatusCounts: {
      all: { data: { count: 6 } },
      open: { data: { count: 2 } },
      allocated: { data: { count: 1 } },
      picked: { data: { count: 1 } },
      shipped: { data: { count: 1 } },
      cancelled: { data: { count: 1 } },
    },
    shipmentsQuery: { data: { count: 1, results: [] }, isLoading: false, error: null },
  });

  renderWithProviders(
    <MemoryRouter>
      <B2BPage />
    </MemoryRouter>,
  );

  expect(mockUseInboundController).toHaveBeenCalledWith(expect.objectContaining({ scopeOrderType: "B2B" }));
  expect(mockUseOutboundController).toHaveBeenCalledWith(expect.objectContaining({ scopeOrderType: "B2B" }));
  expect(screen.getByText("B2B operations")).toBeInTheDocument();
  expect(screen.getByText("Scan receive panel B2B")).toBeInTheDocument();
  expect(screen.getByText("Scan putaway panel B2B")).toBeInTheDocument();
  expect(screen.getByText("Scan and Relabel B2B")).toBeInTheDocument();
  expect(screen.getByText("Scan to pack B2B")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "B2B Stock-in" })).toHaveAttribute("href", "#b2b-stock-in");
  expect(screen.getByRole("heading", { name: "Stock-in List Management" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Scan to Receive" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Scan to List" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "B2B Stock-out" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stock-Out List Manage" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Scan and Relabel" })).toHaveAttribute("href", "#scan-and-relabel");
  expect(screen.getByRole("link", { name: "Scan to pack" })).toHaveAttribute("href", "#scan-to-pack");
  expect(screen.getByRole("heading", { name: "Stock-in Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Signing Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Receiving Record" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Listing Record" })).toBeInTheDocument();
});
