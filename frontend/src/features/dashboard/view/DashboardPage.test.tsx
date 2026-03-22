import { fireEvent, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { DashboardPage } from "@/features/dashboard/view/DashboardPage";
import { renderWithProviders } from "@/test/render";

const mockUseDashboardController = vi.fn();

vi.mock("@/features/dashboard/controller/useDashboardController", () => ({
  useDashboardController: () => mockUseDashboardController(),
}));

vi.mock("@/features/dashboard/view/DashboardTable", () => ({
  DashboardTable: () => <div>Dashboard table</div>,
}));

beforeEach(() => {
  mockUseDashboardController.mockReset();
});

test("renders warehouse-scoped queue cards and links them into filtered queues", async () => {
  const setActiveWarehouseId = vi.fn();

  mockUseDashboardController.mockReturnValue({
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
    activeWarehouseId: 1,
    approvalsSummaryQuery: { data: { pending_count: 5 } },
    canViewFinance: true,
    canViewOps: true,
    company: {
      id: 1,
      openid: "tenant-openid",
      label: "DaChong WMS",
      description: "Test tenant",
    },
    countingDashboardQuery: {
      data: {
        pending_sla_breach_count: 2,
        recount_sla_breach_count: 1,
      },
    },
    invoicesQuery: { data: { count: 3, results: [] } },
    purchaseOrdersQuery: { data: { count: 4, results: [] } },
    queueMetrics: {
      stockIn: {
        pendingStockIn: 12,
        inTransit: 8,
        stockingIn: 4,
      },
      outbound: {
        toGenerateInProcess: 7,
        toShip: 6,
        getTrackingNo: 5,
        toMove: 4,
        toPick: 3,
        toPrintAndStockOut: 2,
        abnormal: 1,
        orderInterception: 9,
      },
      dispatch: {
        shipped: 11,
        notShipped: 10,
        orderCancellation: 1,
      },
      returns: {
        pendingStockIn: 6,
      },
      workOrder: {
        pendingReview: 5,
      },
      finance: {
        deductionPendingReview: 4,
        rechargePendingReview: 3,
        quotaPendingReview: 2,
      },
    },
    rightRailWidgetKeys: [],
    salesOrdersQuery: { data: { count: 8, results: [] } },
    setActiveWarehouseId,
    timeWindow: "WEEK",
    updateWorkbenchPreference: { mutate: vi.fn() },
    visibleOnHand: 1250,
    visibleWidgetKeys: [],
    warehouses: [
      {
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
      {
        id: 2,
        warehouse_name: "Overflow Warehouse",
        warehouse_city: "Dongguan",
        warehouse_address: "2 Warehouse Road",
        warehouse_contact: "Ops Desk",
        warehouse_manager: "Bob",
        creator: "Seeder",
        create_time: "2026-03-20 09:00:00",
        update_time: "2026-03-20 09:00:00",
      },
    ],
  });

  renderWithProviders(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

  expect(screen.getByText("Stock In")).toBeInTheDocument();
  expect(screen.getByText("Dropshipping Stock-Out")).toBeInTheDocument();
  expect(screen.getByText("Dispatch / Handover")).toBeInTheDocument();

  const stockInLink = screen.getByRole("link", { name: /Pending Stock In/i });
  expect(stockInLink).toHaveAttribute("href", "/inbound?poStatuses=OPEN%2CPARTIAL#purchase-orders");

  const financeLink = screen.getByRole("link", { name: /Quota pending review/i });
  expect(financeLink).toHaveAttribute("href", "/finance#voucher-management");

  const toPickLink = screen.getByRole("link", { name: /To Pick/i });
  expect(toPickLink).toHaveAttribute("href", "/outbound?pickTaskStatuses=OPEN%2CASSIGNED#secondary-picking");

  const abnormalLink = screen.getByRole("link", { name: /Abnormal/i });
  expect(abnormalLink).toHaveAttribute("href", "/outbound?salesOrderException=ABNORMAL_PACKAGE#abnormal-package");

  const warehouseSelect = screen.getByRole("combobox", { name: "Warehouse" });
  fireEvent.mouseDown(warehouseSelect);
  fireEvent.click(await screen.findByRole("option", { name: "Overflow Warehouse" }));

  expect(setActiveWarehouseId).toHaveBeenCalledWith(2);
});
