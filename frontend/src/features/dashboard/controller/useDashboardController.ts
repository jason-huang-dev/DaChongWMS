import { useWorkbenchPreference } from "@/app/workspace-preferences";
import { useTenantScope } from "@/app/scope-context";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { dashboardApi } from "@/features/dashboard/model/api";
import { getDashboardAccess, sumVisibleOnHand } from "@/features/dashboard/model/mappers";
import type { CountApprovalSummary, CountingDashboardSummary, InventoryBalanceRecord, InvoiceRecord, PurchaseOrderRecord, SalesOrderRecord } from "@/features/dashboard/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";

export function useDashboardController() {
  const { session } = useAuth();
  const { company, activeWarehouse, activeWarehouseId, warehousesQuery } = useTenantScope();
  const { canViewOps, canViewFinance } = getDashboardAccess(session);
  const { preferenceQuery, updateWorkbenchPreference } = useWorkbenchPreference("dashboard");

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
  const approvalsSummaryQuery = useResource<CountApprovalSummary>(["dashboard", "approval-summary"], dashboardApi.approvalSummary, undefined, {
    enabled: Boolean(session && canViewOps),
  });
  const countingDashboardQuery = useResource<CountingDashboardSummary>(["dashboard", "counting-dashboard"], dashboardApi.countingDashboard, undefined, {
    enabled: Boolean(session && canViewOps),
  });
  const invoicesQuery = usePaginatedResource<InvoiceRecord>(["dashboard", "invoices"], dashboardApi.invoices, 1, 5, undefined, {
    enabled: Boolean(session && canViewFinance),
  });

  return {
    session,
    company,
    canViewOps,
    canViewFinance,
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
    firstWarehouse: activeWarehouse ?? warehousesQuery.data?.results[0],
    visibleOnHand: sumVisibleOnHand(balancesQuery.data?.results ?? []),
  };
}
