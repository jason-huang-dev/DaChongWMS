import { useAuth } from "@/features/auth/controller/useAuthController";
import { dashboardApi } from "@/features/dashboard/model/api";
import { getDashboardAccess, sumVisibleOnHand } from "@/features/dashboard/model/mappers";
import type { CountApprovalSummary, CountingDashboardSummary, InventoryBalanceRecord, InvoiceRecord, PurchaseOrderRecord, SalesOrderRecord, WarehouseRecord } from "@/features/dashboard/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";

export function useDashboardController() {
  const { session } = useAuth();
  const { canViewOps, canViewFinance } = getDashboardAccess(session);

  const warehouseQuery = usePaginatedResource<WarehouseRecord>(["dashboard", "warehouses"], dashboardApi.warehouses, 1, 5, undefined, {
    enabled: Boolean(session && canViewOps),
  });
  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(["dashboard", "balances"], dashboardApi.balances, 1, 10, undefined, {
    enabled: Boolean(session && canViewOps),
  });
  const purchaseOrdersQuery = usePaginatedResource<PurchaseOrderRecord>(["dashboard", "purchase-orders"], dashboardApi.purchaseOrders, 1, 5, undefined, {
    enabled: Boolean(session && canViewOps),
  });
  const salesOrdersQuery = usePaginatedResource<SalesOrderRecord>(["dashboard", "sales-orders"], dashboardApi.salesOrders, 1, 5, undefined, {
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
    canViewOps,
    canViewFinance,
    warehouseQuery,
    balancesQuery,
    purchaseOrdersQuery,
    salesOrdersQuery,
    approvalsSummaryQuery,
    countingDashboardQuery,
    invoicesQuery,
    firstWarehouse: warehouseQuery.data?.results[0],
    visibleOnHand: sumVisibleOnHand(balancesQuery.data?.results ?? []),
  };
}
