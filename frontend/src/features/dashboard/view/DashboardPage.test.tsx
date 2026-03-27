import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, expect, test, vi } from "vitest";

import { DashboardPage } from "@/features/dashboard/view/DashboardPage";
import { renderWithProviders } from "@/test/render";

const mockUseDashboardController = vi.fn();

vi.mock("@/features/dashboard/controller/useDashboardController", () => ({
  useDashboardController: () => mockUseDashboardController(),
}));

beforeEach(() => {
  mockUseDashboardController.mockReset();
});

test("renders warehouse-scoped queue cards and links them into filtered queues", async () => {
  const user = userEvent.setup();
  const setActiveWarehouseId = vi.fn();
  const updateWorkbenchPreference = { isPending: false, mutate: vi.fn() };

  mockUseDashboardController.mockReturnValue({
    activeWarehouseId: 1,
    canViewFinance: true,
    canViewOps: true,
    customDateFrom: null,
    customDateTo: null,
    orderStatisticsQuery: {
      data: {
        buckets: [
          { date: "2026-03-23", dropshipping_orders: 3, stock_in_quantity: 12 },
          { date: "2026-03-24", dropshipping_orders: 4, stock_in_quantity: 18 },
          { date: "2026-03-25", dropshipping_orders: 5, stock_in_quantity: 10 },
        ],
        date_from: "2026-03-23",
        date_to: "2026-03-25",
        summary: {
          dropshipping_orders: 12,
          stock_in_quantity: 40,
        },
        time_window: "WEEK",
      },
      isLoading: false,
    },
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
    setActiveWarehouseId,
    timeWindow: "WEEK",
    updateWorkbenchPreference,
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
    workbenchPreferenceQuery: { data: undefined },
  });

  renderWithProviders(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

  expect(screen.queryByRole("heading", { name: "Operations dashboard" })).not.toBeInTheDocument();
  expect(screen.queryByText("Operational queues")).not.toBeInTheDocument();
  expect(screen.getByText("Stock In")).toBeInTheDocument();
  expect(screen.getByText("Dropshipping Stock-Out")).toBeInTheDocument();
  expect(screen.getByText("Dispatch / Handover")).toBeInTheDocument();
  expect(screen.getByText("Order Qty statistics")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Export" })).toBeInTheDocument();
  expect(screen.getByText("Storage Capacity")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "SKU Qty" })).toBeInTheDocument();
  expect(screen.queryByText("Operations workbench")).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Customize dashboard" })).toBeInTheDocument();

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

  await user.click(screen.getByRole("button", { name: "Customize dashboard" }));

  const customizeDialog = screen.getByRole("dialog", { name: "Customize dashboard" });
  const pendingStockInCheckbox = within(customizeDialog).getByRole("checkbox", { name: "Pending Stock In" });
  const stockInCheckbox = within(customizeDialog).getByRole("checkbox", { name: "Stock In" });
  await user.click(pendingStockInCheckbox);
  await user.click(stockInCheckbox);
  expect(pendingStockInCheckbox).toBeDisabled();
  await user.click(within(customizeDialog).getByRole("checkbox", { name: "Operational queues" }));
  expect(stockInCheckbox).toBeDisabled();
  await user.click(within(customizeDialog).getByRole("button", { name: "Apply" }));

  expect(updateWorkbenchPreference.mutate).toHaveBeenCalledTimes(1);
  const mutationPayload = updateWorkbenchPreference.mutate.mock.calls[0][0];
  expect(mutationPayload).toEqual(
    expect.objectContaining({
      layout_payload: expect.objectContaining({
        hidden_queue_section_keys: [],
      }),
      right_rail_widget_keys: [],
      visible_widget_keys: ["order-trends"],
    }),
  );
  expect(mutationPayload.layout_payload.hidden_queue_metric_keys).not.toContain("stock-in-pending");
  expect(mutationPayload.visible_widget_keys).not.toContain("ops-summary");
  expect(mutationPayload.visible_widget_keys).toContain("order-trends");
});

test("applies a custom date range from the order statistics card", async () => {
  const updateWorkbenchPreference = { isPending: false, mutate: vi.fn() };

  mockUseDashboardController.mockReturnValue({
    activeWarehouseId: 1,
    canViewFinance: true,
    canViewOps: true,
    customDateFrom: null,
    customDateTo: null,
    orderStatisticsQuery: {
      data: {
        buckets: [
          { date: "2026-03-23", dropshipping_orders: 3, stock_in_quantity: 12 },
          { date: "2026-03-24", dropshipping_orders: 4, stock_in_quantity: 18 },
          { date: "2026-03-25", dropshipping_orders: 5, stock_in_quantity: 10 },
        ],
        date_from: "2026-03-23",
        date_to: "2026-03-25",
        summary: {
          dropshipping_orders: 12,
          stock_in_quantity: 40,
        },
        time_window: "WEEK",
      },
      isLoading: false,
    },
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
    setActiveWarehouseId: vi.fn(),
    timeWindow: "WEEK",
    updateWorkbenchPreference,
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
    ],
    workbenchPreferenceQuery: { data: undefined },
  });

  renderWithProviders(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

  fireEvent.change(await screen.findByLabelText("From"), { target: { value: "2026-03-01T08:00" } });
  fireEvent.change(screen.getByLabelText("To"), { target: { value: "2026-03-15T18:00" } });

  await waitFor(() =>
    expect(updateWorkbenchPreference.mutate).toHaveBeenCalledWith({
      custom_date_from: "2026-03-01T08:00",
      custom_date_to: "2026-03-15T18:00",
      time_window: "CUSTOM",
    }),
  );
});
