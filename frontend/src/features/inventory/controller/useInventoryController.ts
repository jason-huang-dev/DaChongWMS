import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runInventoryAdjustmentCreate, runInventoryAgingReportCreate } from "@/features/inventory/controller/actions";
import { inventoryApi } from "@/features/inventory/model/api";
import type {
  InventoryAdjustmentApprovalRuleRecord,
  InventoryAdjustmentReasonRecord,
  InventoryAdjustmentValues,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  OperationalReportExportRecord,
} from "@/features/inventory/model/types";
import { reportingApi } from "@/features/reporting/model/api";
import { useInventoryBalanceReferenceOptions } from "@/shared/hooks/use-reference-options";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

const balancesPageSize = 15;
type InventoryPageKey = "balances" | "aging" | "adjustments" | "crossWarehouse";

interface UseInventoryControllerOptions {
  page?: InventoryPageKey;
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
  const page = options.page ?? "balances";
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
    {
      enabled: page === "balances",
    },
  );

  const stockAgeBalancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "stock-age", "balances"],
    inventoryApi.balances,
    1,
    200,
    warehouseQuery,
    {
      enabled: page === "aging",
    },
  );

  const crossWarehouseBalancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "cross-warehouse", "balances"],
    inventoryApi.balances,
    1,
    200,
    undefined,
    {
      enabled: page === "crossWarehouse" && warehouses.length > 1,
    },
  );

  const adjustmentReasonsQuery = usePaginatedResource<InventoryAdjustmentReasonRecord>(
    ["inventory", "adjustment-reasons"],
    inventoryApi.adjustmentReasons,
    1,
    100,
    { is_active: true },
    {
      enabled: page === "adjustments",
    },
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
    {
      enabled: page === "adjustments",
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
    {
      enabled: page === "adjustments",
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
    {
      enabled: page === "adjustments",
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
    {
      enabled: page === "aging",
    },
  );

  const adjustmentBalanceReference = useInventoryBalanceReferenceOptions(activeWarehouseId, {
    enabled: page === "adjustments",
  });
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
    createAdjustmentMutation,
    crossWarehouseBalancesQuery,
    dataView,
    generateStockAgeReportMutation,
    reportErrorMessage,
    reportExportsQuery,
    reportSuccessMessage,
    stockAgeBalancesQuery,
    warehouses,
  };
}
