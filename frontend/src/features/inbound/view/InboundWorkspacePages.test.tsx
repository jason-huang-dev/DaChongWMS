import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { InboundImportsPage } from "@/features/inbound/view/InboundImportsPage";
import { InboundRecordsPage } from "@/features/inbound/view/InboundRecordsPage";
import { InboundReturnsPage } from "@/features/inbound/view/InboundReturnsPage";
import { renderWithProviders } from "@/test/render";

const mockUseInboundController = vi.fn();

vi.mock("@/features/inbound/controller/useInboundController", () => ({
  useInboundController: () => mockUseInboundController(),
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
    advanceShipmentNoticesQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            asn_number: "ASN-1001",
            purchase_order_number: "PO-1001",
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
    advanceShipmentNoticesView: emptyView,
    importBatchErrorMessage: null,
    importBatchMutation: { isPending: false, mutateAsync: vi.fn() },
    importBatchSuccessMessage: null,
    importBatchesQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            batch_number: "IMP-20260415",
            file_name: "stock-in.csv",
            status: "COMPLETED",
            total_rows: 12,
            success_rows: 12,
            failed_rows: 0,
            summary: "12 rows staged into stock-in",
            failure_rows: [],
            imported_by: "Alice",
            imported_at: "2026-04-15T10:00:00Z",
            creator: "Seeder",
            openid: "import-batch-1",
            create_time: "2026-04-15T09:58:00Z",
            update_time: "2026-04-15T10:00:00Z",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    importBatchesView: emptyView,
    putawayTasksQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            task_number: "PT-1001",
            receipt_number: "RCPT-1001",
            goods_code: "SKU-1",
            from_location_code: "STAGE-01",
            to_location_code: "A-01-01",
            quantity: 12,
            status: "OPEN",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    putawayTasksView: emptyView,
    receiptsQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            receipt_number: "RCPT-1001",
            purchase_order_number: "PO-1001",
            asn_number: "ASN-1001",
            receipt_location_code: "RCV-01",
            received_at: "2026-04-15T10:30:00Z",
            received_by: "Dock Lead",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    receiptsView: emptyView,
    returnOrdersQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            return_number: "RMA-1001",
            customer_name: "Client A",
            sales_order_number: "SO-1001",
            requested_date: "2026-04-15T09:00:00Z",
            status: "OPEN",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    returnOrdersView: emptyView,
    returnReceiptsQuery: { data: { count: 2, results: [] }, isLoading: false, error: null },
    signingRecordsQuery: {
      data: {
        count: 1,
        results: [
          {
            id: 1,
            signing_number: "SIGN-1001",
            purchase_order_number: "PO-1001",
            asn_number: "ASN-1001",
            carrier_name: "DHL",
            vehicle_plate: "VH-12345",
            signed_by: "Alice",
            signed_at: "2026-04-15T08:45:00Z",
          },
        ],
      },
      isLoading: false,
      error: null,
    },
    signingRecordsView: emptyView,
  });
});

test("renders import subpages from the grouped inbound imports page", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <MemoryRouter initialEntries={["/inbound/imports"]}>
      <InboundImportsPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("Stock-in import panel")).toBeInTheDocument();
  expect(screen.getByText("IMP-20260415")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search import batch")).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "Import Management" }));

  expect(screen.queryByText("Stock-in import panel")).not.toBeInTheDocument();
  expect(screen.getByText("IMP-20260415")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("Search import batch")).toBeInTheDocument();
  expect(screen.getByText("stock-in.csv")).toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "Upload batch" }));

  expect(screen.getByText("Stock-in import panel")).toBeInTheDocument();
});

test("renders record subpages from the grouped inbound records page", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <MemoryRouter initialEntries={["/inbound/records"]}>
      <InboundRecordsPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("ASN-1001")).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: "Receiving Record" }));

  expect(screen.getByText("RCPT-1001")).toBeInTheDocument();
});

test("renders returns management inside the grouped inbound returns page", () => {
  renderWithProviders(
    <MemoryRouter initialEntries={["/inbound/returns"]}>
      <InboundReturnsPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole("tab", { name: "Return order management" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open returns workspace" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "RMA-1001" })).toHaveAttribute("href", "/returns/return-orders/1");
});
