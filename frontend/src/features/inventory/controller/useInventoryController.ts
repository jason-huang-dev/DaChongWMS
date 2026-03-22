import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runInventoryAdjustmentCreate, runInventoryAgingReportCreate } from "@/features/inventory/controller/actions";
import { inventoryApi } from "@/features/inventory/model/api";
import type {
  CountApprovalQueueRecord,
  CountingDashboardSummary,
  InventoryAdjustmentApprovalRuleRecord,
  InventoryAdjustmentReasonRecord,
  InventoryAdjustmentValues,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  OperationalReportExportRecord,
  ReplenishmentTaskRecord,
  TransferOrderRecord,
} from "@/features/inventory/model/types";
import { countingApi } from "@/features/counting/model/api";
import { reportingApi } from "@/features/reporting/model/api";
import { transfersApi } from "@/features/transfers/model/api";
import { useInventoryBalanceReferenceOptions } from "@/shared/hooks/use-reference-options";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

const balancesPageSize = 15;

interface UseInventoryControllerOptions {
  initialBalancesFilters?: {
    search?: string;
    stock_status?: string;
    lot_number__icontains?: string;
    serial_number__icontains?: string;
  };
}

export function useInventoryController(options: UseInventoryControllerOptions = {}) {
  const { company, activeWarehouse, activeWarehouseId, warehouses } = useTenantScope();
  const queryClient = useQueryClient();
  const [adjustmentSuccessMessage, setAdjustmentSuccessMessage] = useState<string | null>(null);
  const [adjustmentErrorMessage, setAdjustmentErrorMessage] = useState<string | null>(null);
  const [reportSuccessMessage, setReportSuccessMessage] = useState<string | null>(null);
  const [reportErrorMessage, setReportErrorMessage] = useState<string | null>(null);

  const dataView = useDataView({
    viewKey: `inventory-balances.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      search: options.initialBalancesFilters?.search ?? "",
      stock_status: options.initialBalancesFilters?.stock_status ?? "",
      lot_number__icontains: options.initialBalancesFilters?.lot_number__icontains ?? "",
      serial_number__icontains: options.initialBalancesFilters?.serial_number__icontains ?? "",
    },
    pageSize: balancesPageSize,
  });

  const warehouseQuery = activeWarehouseId ? { warehouse: activeWarehouseId } : {};

  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "balances"],
    inventoryApi.balances,
    dataView.page,
    balancesPageSize,
    {
      ...warehouseQuery,
      ...dataView.queryFilters,
    },
  );

  const stockAgeBalancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "stock-age", "balances"],
    inventoryApi.balances,
    1,
    200,
    warehouseQuery,
  );

  const crossWarehouseBalancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "cross-warehouse", "balances"],
    inventoryApi.balances,
    1,
    200,
    undefined,
    {
      enabled: warehouses.length > 1,
    },
  );

  const countDashboardQuery = useResource<CountingDashboardSummary>(
    ["inventory", "counting", "dashboard"],
    countingApi.approvalsDashboard,
    warehouseQuery,
  );

  const countQueueQuery = usePaginatedResource<CountApprovalQueueRecord>(
    ["inventory", "counting", "queue"],
    countingApi.approvalsQueue,
    1,
    6,
    {
      ...warehouseQuery,
      status: "PENDING",
    },
  );

  const transferOrdersQuery = usePaginatedResource<TransferOrderRecord>(
    ["inventory", "transfers", "orders"],
    transfersApi.transferOrders,
    1,
    6,
    {
      ...warehouseQuery,
      status: "OPEN",
    },
  );

  const replenishmentTasksQuery = usePaginatedResource<ReplenishmentTaskRecord>(
    ["inventory", "transfers", "replenishment-tasks"],
    transfersApi.replenishmentTasks,
    1,
    6,
    {
      ...warehouseQuery,
      status: "OPEN",
    },
  );

  const adjustmentReasonsQuery = usePaginatedResource<InventoryAdjustmentReasonRecord>(
    ["inventory", "adjustment-reasons"],
    inventoryApi.adjustmentReasons,
    1,
    100,
    { is_active: true },
  );

  const adjustmentRulesQuery = usePaginatedResource<InventoryAdjustmentApprovalRuleRecord>(
    ["inventory", "adjustment-rules"],
    inventoryApi.adjustmentRules,
    1,
    100,
    {
      is_active: true,
      warehouse: activeWarehouseId ?? undefined,
    },
  );

  const adjustmentInQuery = usePaginatedResource<InventoryMovementRecord>(
    ["inventory", "movements", "adjustment-in"],
    inventoryApi.movements,
    1,
    12,
    {
      ...warehouseQuery,
      movement_type: "ADJUSTMENT_IN",
    },
  );

  const adjustmentOutQuery = usePaginatedResource<InventoryMovementRecord>(
    ["inventory", "movements", "adjustment-out"],
    inventoryApi.movements,
    1,
    12,
    {
      ...warehouseQuery,
      movement_type: "ADJUSTMENT_OUT",
    },
  );

  const reportExportsQuery = usePaginatedResource<OperationalReportExportRecord>(
    ["inventory", "reports", "aging"],
    reportingApi.reportExports,
    1,
    6,
    {
      ...warehouseQuery,
      report_type: "INVENTORY_AGING",
    },
  );

  const adjustmentBalanceReference = useInventoryBalanceReferenceOptions(activeWarehouseId);
  const adjustmentBalancesById = new Map(
    adjustmentBalanceReference.options.map((option) => [option.value, option.record]),
  );

  const createAdjustmentMutation = useMutation({
    mutationFn: (values: InventoryAdjustmentValues) =>
      runInventoryAdjustmentCreate(values, adjustmentBalancesById),
    onSuccess: async (movement) => {
      setAdjustmentErrorMessage(null);
      setAdjustmentSuccessMessage(
        `Inventory adjustment posted for ${movement.goods_code} at ${movement.to_location_code || movement.from_location_code}.`,
      );
      await invalidateQueryGroups(queryClient, [
        ["dashboard"],
        ["inventory"],
      ]);
    },
    onError: (error: unknown) => {
      setAdjustmentSuccessMessage(null);
      setAdjustmentErrorMessage(parseApiError(error));
    },
  });

  const generateStockAgeReportMutation = useMutation({
    mutationFn: () => runInventoryAgingReportCreate(activeWarehouseId),
    onSuccess: async (reportExport) => {
      setReportErrorMessage(null);
      setReportSuccessMessage(`Generated ${reportExport.file_name}.`);
      await invalidateQueryGroups(queryClient, [
        ["inventory", "reports"],
      ]);
    },
    onError: (error: unknown) => {
      setReportSuccessMessage(null);
      setReportErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    activeWarehouseId,
    adjustmentBalanceReference,
    adjustmentErrorMessage,
    adjustmentInQuery,
    adjustmentReasonsQuery,
    adjustmentRulesQuery,
    adjustmentOutQuery,
    adjustmentSuccessMessage,
    balancesQuery,
    countDashboardQuery,
    countQueueQuery,
    createAdjustmentMutation,
    crossWarehouseBalancesQuery,
    dataView,
    generateStockAgeReportMutation,
    reportErrorMessage,
    reportExportsQuery,
    reportSuccessMessage,
    replenishmentTasksQuery,
    stockAgeBalancesQuery,
    transferOrdersQuery,
    warehouses,
  };
}
