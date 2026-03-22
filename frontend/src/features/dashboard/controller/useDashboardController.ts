import { useWorkbenchPreference } from "@/app/workspace-preferences";
import { useTenantScope } from "@/app/scope-context";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { dashboardApi } from "@/features/dashboard/model/api";
import { getDashboardAccess, sumVisibleOnHand } from "@/features/dashboard/model/mappers";
import { buildBalanceTransactionsPath, buildVouchersPath } from "@/features/fees/model/api";
import type { BalanceTransactionRecord, VoucherRecord } from "@/features/fees/model/types";
import type {
  AdvanceShipmentNoticeRecord,
  CountApprovalSummary,
  CountingDashboardSummary,
  InventoryBalanceRecord,
  InvoiceRecord,
  PickTaskRecord,
  PutawayTaskRecord,
  PurchaseOrderRecord,
  ReturnOrderRecord,
  SalesOrderRecord,
} from "@/features/dashboard/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";

function useDashboardCount<TRecord>(
  queryKey: readonly unknown[],
  path: string,
  extraQuery?: Record<string, string | number | boolean | null | undefined>,
  enabled = true,
) {
  return usePaginatedResource<TRecord>(queryKey, path, 1, 1, extraQuery, { enabled });
}

export function useDashboardController() {
  const { session } = useAuth();
  const {
    company,
    activeWarehouse,
    activeWarehouseId,
    setActiveWarehouseId,
    warehouses,
    warehousesQuery,
  } = useTenantScope();
  const { canViewOps, canViewFinance } = getDashboardAccess(session);
  const { preferenceQuery, updateWorkbenchPreference } = useWorkbenchPreference("dashboard");
  const companyId =
    typeof company?.id === "number"
      ? company.id
      : typeof company?.id === "string" && company.id.length > 0
        ? Number(company.id)
        : undefined;
  const warehouseScopedQuery = { warehouse: activeWarehouseId ?? undefined };

  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(["dashboard", "balances"], dashboardApi.balances, 1, 10, {
    warehouse: activeWarehouseId ?? undefined,
  }, {
    enabled: Boolean(session && canViewOps),
  });
  const purchaseOrdersQuery = usePaginatedResource<PurchaseOrderRecord>(["dashboard", "purchase-orders"], dashboardApi.purchaseOrders, 1, 5, {
    warehouse: activeWarehouseId ?? undefined,
  }, {
    enabled: Boolean(session && canViewOps),
  });
  const salesOrdersQuery = usePaginatedResource<SalesOrderRecord>(["dashboard", "sales-orders"], dashboardApi.salesOrders, 1, 5, {
    warehouse: activeWarehouseId ?? undefined,
  }, {
    enabled: Boolean(session && canViewOps),
  });
  const approvalsSummaryQuery = useResource<CountApprovalSummary>(["dashboard", "approval-summary"], dashboardApi.approvalSummary, warehouseScopedQuery, {
    enabled: Boolean(session && canViewOps),
  });
  const countingDashboardQuery = useResource<CountingDashboardSummary>(["dashboard", "counting-dashboard"], dashboardApi.countingDashboard, warehouseScopedQuery, {
    enabled: Boolean(session && canViewOps),
  });
  const invoicesQuery = usePaginatedResource<InvoiceRecord>(["dashboard", "invoices"], dashboardApi.invoices, 1, 5, warehouseScopedQuery, {
    enabled: Boolean(session && canViewFinance),
  });

  const pendingStockInOpenQuery = useDashboardCount<PurchaseOrderRecord>(
    ["dashboard", "counts", "purchase-orders", "open"],
    dashboardApi.purchaseOrders,
    { ...warehouseScopedQuery, status: "OPEN" },
    Boolean(session && canViewOps),
  );
  const pendingStockInPartialQuery = useDashboardCount<PurchaseOrderRecord>(
    ["dashboard", "counts", "purchase-orders", "partial"],
    dashboardApi.purchaseOrders,
    { ...warehouseScopedQuery, status: "PARTIAL" },
    Boolean(session && canViewOps),
  );
  const inTransitOpenQuery = useDashboardCount<AdvanceShipmentNoticeRecord>(
    ["dashboard", "counts", "asns", "open"],
    dashboardApi.advanceShipmentNotices,
    { ...warehouseScopedQuery, status: "OPEN" },
    Boolean(session && canViewOps),
  );
  const inTransitPartialQuery = useDashboardCount<AdvanceShipmentNoticeRecord>(
    ["dashboard", "counts", "asns", "partial"],
    dashboardApi.advanceShipmentNotices,
    { ...warehouseScopedQuery, status: "PARTIAL" },
    Boolean(session && canViewOps),
  );
  const stockingInOpenQuery = useDashboardCount<PutawayTaskRecord>(
    ["dashboard", "counts", "putaway-tasks", "open"],
    dashboardApi.putawayTasks,
    { ...warehouseScopedQuery, status: "OPEN" },
    Boolean(session && canViewOps),
  );
  const stockingInAssignedQuery = useDashboardCount<PutawayTaskRecord>(
    ["dashboard", "counts", "putaway-tasks", "assigned"],
    dashboardApi.putawayTasks,
    { ...warehouseScopedQuery, status: "ASSIGNED" },
    Boolean(session && canViewOps),
  );

  const outboundInProcessQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "in-process"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, fulfillment_stage: "IN_PROCESS" },
    Boolean(session && canViewOps),
  );
  const outboundToShipPrintedQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "to-ship-printed"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, fulfillment_stage: "TO_SHIP", waybill_printed: true },
    Boolean(session && canViewOps),
  );
  const outboundGetTrackingQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "get-tracking-no"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, fulfillment_stage: "GET_TRACKING_NO" },
    Boolean(session && canViewOps),
  );
  const outboundToMoveQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "to-move"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, fulfillment_stage: "TO_MOVE" },
    Boolean(session && canViewOps),
  );
  const outboundPickOpenQuery = useDashboardCount<PickTaskRecord>(
    ["dashboard", "counts", "pick-tasks", "open"],
    dashboardApi.pickTasks,
    { ...warehouseScopedQuery, status: "OPEN" },
    Boolean(session && canViewOps),
  );
  const outboundPickAssignedQuery = useDashboardCount<PickTaskRecord>(
    ["dashboard", "counts", "pick-tasks", "assigned"],
    dashboardApi.pickTasks,
    { ...warehouseScopedQuery, status: "ASSIGNED" },
    Boolean(session && canViewOps),
  );
  const outboundToPrintQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "to-print-stock-out"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, fulfillment_stage: "TO_SHIP", waybill_printed: false },
    Boolean(session && canViewOps),
  );
  const outboundAbnormalQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "abnormal"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, exception_state: "ABNORMAL_PACKAGE" },
    Boolean(session && canViewOps),
  );
  const outboundInterceptionQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "interception"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, exception_state: "ORDER_INTERCEPTION" },
    Boolean(session && canViewOps),
  );
  const outboundAllQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "all"],
    dashboardApi.salesOrders,
    warehouseScopedQuery,
    Boolean(session && canViewOps),
  );
  const outboundShippedQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "shipped"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, status: "SHIPPED" },
    Boolean(session && canViewOps),
  );
  const outboundCancelledQuery = useDashboardCount<SalesOrderRecord>(
    ["dashboard", "counts", "sales-orders", "cancelled"],
    dashboardApi.salesOrders,
    { ...warehouseScopedQuery, status: "CANCELLED" },
    Boolean(session && canViewOps),
  );

  const returnsOpenQuery = useDashboardCount<ReturnOrderRecord>(
    ["dashboard", "counts", "returns", "open"],
    dashboardApi.returnOrders,
    { ...warehouseScopedQuery, status: "OPEN" },
    Boolean(session && canViewOps),
  );
  const returnsPartialReceivedQuery = useDashboardCount<ReturnOrderRecord>(
    ["dashboard", "counts", "returns", "partial-received"],
    dashboardApi.returnOrders,
    { ...warehouseScopedQuery, status: "PARTIAL_RECEIVED" },
    Boolean(session && canViewOps),
  );

  const deductionPendingReviewQuery = useResource<BalanceTransactionRecord[]>(
    ["dashboard", "fees", "balance-transactions", "deduction-pending-review", companyId],
    buildBalanceTransactionsPath(companyId ?? "0"),
    {
      status: "PENDING_REVIEW",
      transaction_type: "DEDUCTION",
    },
    {
      enabled: Boolean(session && canViewFinance && companyId),
    },
  );
  const rechargePendingReviewQuery = useResource<BalanceTransactionRecord[]>(
    ["dashboard", "fees", "balance-transactions", "recharge-pending-review", companyId],
    buildBalanceTransactionsPath(companyId ?? "0"),
    {
      status: "PENDING_REVIEW",
      transaction_type: "RECHARGE",
    },
    {
      enabled: Boolean(session && canViewFinance && companyId),
    },
  );
  const quotaPendingReviewQuery = useResource<VoucherRecord[]>(
    ["dashboard", "fees", "vouchers", "draft", companyId],
    buildVouchersPath(companyId ?? "0"),
    {
      status: "DRAFT",
    },
    {
      enabled: Boolean(session && canViewFinance && companyId),
    },
  );

  const pendingStockInCount = (pendingStockInOpenQuery.data?.count ?? 0) + (pendingStockInPartialQuery.data?.count ?? 0);
  const inTransitCount = (inTransitOpenQuery.data?.count ?? 0) + (inTransitPartialQuery.data?.count ?? 0);
  const stockingInCount = (stockingInOpenQuery.data?.count ?? 0) + (stockingInAssignedQuery.data?.count ?? 0);
  const toPickCount = (outboundPickOpenQuery.data?.count ?? 0) + (outboundPickAssignedQuery.data?.count ?? 0);
  const notShippedCount = Math.max(
    (outboundAllQuery.data?.count ?? 0) - (outboundShippedQuery.data?.count ?? 0) - (outboundCancelledQuery.data?.count ?? 0),
    0,
  );
  const pendingReturnStockInCount = (returnsOpenQuery.data?.count ?? 0) + (returnsPartialReceivedQuery.data?.count ?? 0);

  return {
    session,
    company,
    canViewOps,
    canViewFinance,
    warehouses,
    warehousesQuery,
    balancesQuery,
    purchaseOrdersQuery,
    salesOrdersQuery,
    approvalsSummaryQuery,
    countingDashboardQuery,
    invoicesQuery,
    workbenchPreferenceQuery: preferenceQuery,
    updateWorkbenchPreference,
    timeWindow: preferenceQuery.data?.time_window ?? "WEEK",
    visibleWidgetKeys: preferenceQuery.data?.visible_widget_keys ?? [],
    rightRailWidgetKeys: preferenceQuery.data?.right_rail_widget_keys ?? [],
    activeWarehouse,
    activeWarehouseId,
    setActiveWarehouseId,
    firstWarehouse: activeWarehouse ?? warehousesQuery.data?.results[0],
    visibleOnHand: sumVisibleOnHand(balancesQuery.data?.results ?? []),
    queueMetrics: {
      stockIn: {
        pendingStockIn: pendingStockInCount,
        inTransit: inTransitCount,
        stockingIn: stockingInCount,
      },
      outbound: {
        toGenerateInProcess: outboundInProcessQuery.data?.count ?? 0,
        toShip: outboundToShipPrintedQuery.data?.count ?? 0,
        getTrackingNo: outboundGetTrackingQuery.data?.count ?? 0,
        toMove: outboundToMoveQuery.data?.count ?? 0,
        toPick: toPickCount,
        toPrintAndStockOut: outboundToPrintQuery.data?.count ?? 0,
        abnormal: outboundAbnormalQuery.data?.count ?? 0,
        orderInterception: outboundInterceptionQuery.data?.count ?? 0,
      },
      dispatch: {
        shipped: outboundShippedQuery.data?.count ?? 0,
        notShipped: notShippedCount,
        orderCancellation: outboundCancelledQuery.data?.count ?? 0,
      },
      returns: {
        pendingStockIn: pendingReturnStockInCount,
      },
      workOrder: {
        pendingReview: approvalsSummaryQuery.data?.pending_count ?? 0,
      },
      finance: {
        deductionPendingReview: deductionPendingReviewQuery.data?.length ?? 0,
        rechargePendingReview: rechargePendingReviewQuery.data?.length ?? 0,
        quotaPendingReview: quotaPendingReviewQuery.data?.length ?? 0,
      },
    },
  };
}
