import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import type { StockInListFilters } from "@/features/inbound/model/stock-in-list-management";
import type { PurchaseOrderRecord } from "@/features/inbound/model/types";
import { StockInListManagementSection } from "@/features/inbound/view/components/StockInListManagementSection";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { PaginatedResponse } from "@/shared/types/api";
import { renderWithProviders } from "@/test/render";

const defaultFilters: StockInListFilters = {
  po_number__icontains: "",
  status: "",
  status__in: "OPEN,PARTIAL",
  searchField: "po_number",
  searchValue: "PO-1001",
  dateField: "create_time",
  dateFrom: "2026-04-01",
  dateTo: "2026-04-16",
};

const mockPurchaseOrdersView: UseDataViewResult<StockInListFilters> = {
  activeFilterCount: 2,
  applySavedView: vi.fn(),
  deleteSavedView: vi.fn(),
  filters: defaultFilters,
  page: 1,
  pageSize: 8,
  queryFilters: {},
  resetFilters: vi.fn(),
  saveCurrentView: vi.fn(),
  savedViews: [{ id: "view-1", name: "Dock focus", filters: defaultFilters }],
  selectedSavedViewId: "view-1",
  setPage: vi.fn(),
  updateFilter: vi.fn(),
};

function buildPurchaseOrdersResponse(results: PurchaseOrderRecord[]): PaginatedResponse<PurchaseOrderRecord> {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

test("renders the shared stock-in filter card and table layout", () => {
  renderWithProviders(
    <MemoryRouter>
      <StockInListManagementSection
        activeWarehouse={{ warehouse_name: "Main Warehouse" }}
        purchaseOrdersQuery={{
          data: buildPurchaseOrdersResponse([
            {
              id: 1,
              warehouse: 1,
              warehouse_name: "Main Warehouse",
              supplier: 1,
              supplier_name: "Atlas Freight",
              customer_code: "INB-001",
              customer_name: "Inbound Client",
              po_number: "PO-1001",
              expected_arrival_date: "2026-04-09",
              status: "OPEN",
              reference_code: "REF-1001",
              notes: "",
              lines: [
                {
                  id: 10,
                  line_number: 1,
                  goods: 100,
                  goods_code: "SKU-100",
                  ordered_qty: "5.0000",
                  received_qty: "2.0000",
                  unit_cost: "3.5000",
                  stock_status: "AVAILABLE",
                  status: "PARTIAL",
                },
              ],
              creator: "tester",
              create_time: "2026-04-03T08:00:00Z",
              update_time: "2026-04-04T09:30:00Z",
            },
          ]),
          error: null,
          isLoading: false,
        }}
        purchaseOrdersView={mockPurchaseOrdersView}
      />
    </MemoryRouter>,
  );

  expect(screen.getByTestId("stock-in-list-page-chrome")).toBeInTheDocument();
  expect(screen.getByRole("tab", { name: "Completed" })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "PO-1001" })).toHaveAttribute("href", "/inbound/purchase-orders/1");
  expect(screen.getByText("1 results")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Save view" })).toBeInTheDocument();
});

test("maps the completed status tab to closed purchase orders", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <MemoryRouter>
      <StockInListManagementSection
        activeWarehouse={{ warehouse_name: "Main Warehouse" }}
        purchaseOrdersQuery={{ data: buildPurchaseOrdersResponse([]), error: null, isLoading: false }}
        purchaseOrdersView={mockPurchaseOrdersView}
      />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("tab", { name: "Completed" }));

  expect(mockPurchaseOrdersView.updateFilter).toHaveBeenNthCalledWith(1, "status", "CLOSED");
  expect(mockPurchaseOrdersView.updateFilter).toHaveBeenNthCalledWith(2, "status__in", "");
});

test("resets stock-in filters from the filter card", async () => {
  const user = userEvent.setup();

  renderWithProviders(
    <MemoryRouter>
      <StockInListManagementSection
        activeWarehouse={{ warehouse_name: "Main Warehouse" }}
        purchaseOrdersQuery={{ data: buildPurchaseOrdersResponse([]), error: null, isLoading: false }}
        purchaseOrdersView={mockPurchaseOrdersView}
      />
    </MemoryRouter>,
  );

  await user.click(screen.getByRole("button", { name: "Reset" }));

  expect(mockPurchaseOrdersView.resetFilters).toHaveBeenCalledTimes(1);
});
