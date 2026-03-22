import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { StatisticsPage } from "@/features/statistics/view/StatisticsPage";
import { renderWithProviders } from "@/test/render";

const mockUseStatisticsController = vi.fn();

vi.mock("@/features/statistics/controller/useStatisticsController", () => ({
  useStatisticsController: () => mockUseStatisticsController(),
}));

const emptyQuery = { isLoading: false, error: null };

beforeEach(() => {
  mockUseStatisticsController.mockReset();
});

test("renders the statistics workbench sections", () => {
  mockUseStatisticsController.mockReturnValue({
    company: { id: 1, openid: "tenant-openid", label: "Acme WMS", description: "Primary workspace" },
    activeWarehouse: { id: 1, warehouse_name: "Main WH" },
    warehouses: [{ id: 1, warehouse_name: "Main WH" }],
    timeWindow: "MONTH",
    setTimeWindow: vi.fn(),
    standardPurchaseOrdersQuery: emptyQuery,
    standardAsnsQuery: emptyQuery,
    signingQuery: emptyQuery,
    receivingQuery: emptyQuery,
    listingQuery: emptyQuery,
    salesOrdersQuery: emptyQuery,
    pickingQuery: emptyQuery,
    packingQuery: emptyQuery,
    shipmentsQuery: emptyQuery,
    returnOrdersQuery: emptyQuery,
    returnReceiptsQuery: emptyQuery,
    returnDispositionsQuery: emptyQuery,
    warehouseAnalysisQuery: emptyQuery,
    stockInOutRows: [
      {
        id: "flow-1",
        segment: "Standard Stock-in",
        documents: 5,
        units: 120,
        completed_documents: 4,
        completed_units: 110,
        focus: "Inbound flow",
      },
    ],
    standardStockInRows: [
      {
        id: "standard-1",
        segment: "Purchase orders",
        documents: 2,
        units: 40,
        completed_documents: 1,
        completed_units: 20,
        focus: "Inbound planning",
      },
    ],
    stockOutRows: [
      {
        id: "stockout-1",
        segment: "Sales orders",
        documents: 3,
        units: 80,
        completed_documents: 2,
        completed_units: 50,
        focus: "Order demand",
      },
    ],
    warehouseAnalysisRows: [
      {
        id: "warehouse-1",
        warehouse_name: "Main WH",
        on_hand_units: 640,
        standard_stock_in_orders: 2,
        stock_out_orders: 3,
        direct_shipping_orders: 1,
        after_sales_returns: 0,
      },
    ],
    staffPerformanceRows: [
      {
        id: "staff-1",
        staff_name: "Alex",
        receiving: 3,
        listing: 2,
        picking: 4,
        packing: 5,
        after_sales: 1,
        total_activities: 15,
        total_quantity: 250,
        last_activity_at: "2026-03-22T10:00:00Z",
      },
    ],
    receivingRows: [
      {
        id: "receiving-1",
        staff_name: "Alex",
        activity_count: 3,
        quantity: 120,
        last_activity_at: "2026-03-22T08:00:00Z",
      },
    ],
    listingRows: [
      {
        id: "listing-1",
        staff_name: "Casey",
        activity_count: 2,
        quantity: 60,
        last_activity_at: "2026-03-22T08:30:00Z",
      },
    ],
    pickingRows: [
      {
        id: "picking-1",
        staff_name: "Jordan",
        activity_count: 4,
        quantity: 80,
        last_activity_at: "2026-03-22T09:00:00Z",
      },
    ],
    packingRows: [
      {
        id: "packing-1",
        staff_name: "Taylor",
        activity_count: 5,
        quantity: 50,
        last_activity_at: "2026-03-22T09:30:00Z",
      },
    ],
    afterSalesRows: [
      {
        id: "after-sales-activity-1",
        staff_name: "Morgan",
        activity_count: 1,
        quantity: 10,
        last_activity_at: "2026-03-22T09:45:00Z",
      },
    ],
    afterSalesStatisticsRows: [
      {
        id: "after-sales-1",
        segment: "Return orders",
        documents: 1,
        units: 10,
        completed_documents: 1,
        completed_units: 10,
        focus: "Customer after sales",
      },
    ],
    directShippingRows: [
      {
        id: "dropship-1",
        segment: "Direct Shipping",
        documents: 2,
        units: 20,
        completed_documents: 1,
        completed_units: 10,
        focus: "Dropship order mix",
      },
    ],
    summary: {
      currentPeriod: "MONTH",
      inboundDocuments: 7,
      outboundDocuments: 5,
      directShippingOrders: 2,
      afterSalesOrders: 1,
      onHandUnits: 640,
      activeWarehouses: 1,
      activeStaff: 4,
      topPerformer: {
        staff_name: "Alex",
        total_activities: 15,
      },
    },
  });

  renderWithProviders(
    <MemoryRouter>
      <StatisticsPage />
    </MemoryRouter>,
  );

  expect(screen.getByRole("heading", { name: "Statistics" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Stock In&Out" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Standard Stock-in" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Stock Out Statistics" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Warehouse Analysis" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Staff Performance" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Receiving" })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "Listing" })).toBeInTheDocument();
  expect(screen.getAllByRole("heading", { name: "Picking" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "Packing" }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("heading", { name: "After Sales" }).length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Direct Shipping" })).toBeInTheDocument();
  expect(screen.getAllByText("Alex").length).toBeGreaterThan(0);
  expect(screen.getAllByText("Main WH").length).toBeGreaterThan(0);
});
