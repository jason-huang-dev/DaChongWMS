import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runReplenishmentTaskComplete,
  runReplenishmentTaskGenerate,
  runTransferLineComplete,
  runTransferOrderCreate,
  runTransferOrderArchive,
  runTransferOrderUpdate,
} from "@/features/transfers/controller/actions";
import { defaultTransferOrderCreateValues, defaultTransferOrderEditValues, mapTransferOrderToEditValues } from "@/features/transfers/model/mappers";
import { transfersApi } from "@/features/transfers/model/api";
import type {
  InventoryBalanceRecord,
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderCreateValues,
  TransferOrderEditValues,
  TransferOrderRecord,
} from "@/features/transfers/model/types";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { executeBulkAction } from "@/shared/lib/bulk-actions";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateTransfersQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [
    ["transfers"],
    ["dashboard"],
    ["inventory"],
  ]);
}

export function useTransfersController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const transferOrderSelection = useBulkSelection<number>();
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);
  const transferOrdersView = useDataView({
    viewKey: `transfers.transfer-orders.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      transfer_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const transferLinesView = useDataView({
    viewKey: `transfers.transfer-lines.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: "",
      assigned_to__isnull: "",
    },
    pageSize: 8,
  });
  const replenishmentRulesView = useDataView({
    viewKey: `transfers.replenishment-rules.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      stock_status: "",
      is_active: "",
    },
    pageSize: 8,
  });
  const replenishmentTasksView = useDataView({
    viewKey: `transfers.replenishment-tasks.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      status: "",
      assigned_to__isnull: "",
    },
    pageSize: 8,
  });

  const createTransferOrderMutation = useMutation({
    mutationFn: ({
      balancesById,
      values,
    }: {
      values: TransferOrderCreateValues;
      balancesById: Map<number, InventoryBalanceRecord>;
    }) => runTransferOrderCreate(values, balancesById),
    onSuccess: async (transferOrder) => {
      setCreateErrorMessage(null);
      setCreateSuccessMessage(`Transfer order ${transferOrder.transfer_number} created.`);
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setCreateSuccessMessage(null);
      setCreateErrorMessage(parseApiError(error));
    },
  });

  const transferOrdersQuery = usePaginatedResource<TransferOrderRecord>(
    ["transfers", "transfer-orders"],
    transfersApi.transferOrders,
    transferOrdersView.page,
    transferOrdersView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...transferOrdersView.queryFilters,
    },
  );
  const transferLinesQuery = usePaginatedResource<TransferLineRecord>(
    ["transfers", "transfer-lines"],
    transfersApi.transferLines,
    transferLinesView.page,
    transferLinesView.pageSize,
    {
      ...transferLinesView.queryFilters,
    },
  );
  const replenishmentRulesQuery = usePaginatedResource<ReplenishmentRuleRecord>(
    ["transfers", "replenishment-rules"],
    transfersApi.replenishmentRules,
    replenishmentRulesView.page,
    replenishmentRulesView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...replenishmentRulesView.queryFilters,
    },
  );
  const replenishmentTasksQuery = usePaginatedResource<ReplenishmentTaskRecord>(
    ["transfers", "replenishment-tasks"],
    transfersApi.replenishmentTasks,
    replenishmentTasksView.page,
    replenishmentTasksView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...replenishmentTasksView.queryFilters,
    },
  );

  const generateTaskMutation = useMutation({
    mutationFn: (replenishmentRuleId: number) =>
      runReplenishmentTaskGenerate(replenishmentRuleId),
    onSuccess: async (task) => {
      setActionErrorMessage(null);
      setActionSuccessMessage(
        `Replenishment task ${task.task_number} generated for ${task.goods_code}.`,
      );
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setActionSuccessMessage(null);
      setActionErrorMessage(parseApiError(error));
    },
  });

  const completeTaskMutation = useMutation({
    mutationFn: (replenishmentTaskId: number) =>
      runReplenishmentTaskComplete(replenishmentTaskId),
    onSuccess: async (task) => {
      setActionErrorMessage(null);
      setActionSuccessMessage(
        `Replenishment task ${task.task_number} completed to ${task.to_location_code}.`,
      );
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setActionSuccessMessage(null);
      setActionErrorMessage(parseApiError(error));
    },
  });

  const bulkArchiveMutation = useMutation({
    mutationFn: (transferOrderIds: number[]) =>
      executeBulkAction(transferOrderIds, (transferOrderId) =>
        runTransferOrderArchive(String(transferOrderId)),
      ),
    onSuccess: async (result) => {
      setActionSuccessMessage(
        result.successCount > 0
          ? `Archived ${result.successCount} transfer order${result.successCount === 1 ? "" : "s"}.`
          : null,
      );
      setActionErrorMessage(
        result.failures.length > 0
          ? `Failed ${result.failures.length} transfer archive${result.failures.length === 1 ? "" : "s"}: ${result.failures
              .slice(0, 3)
              .map((failure) => `#${failure.item} ${failure.message}`)
              .join("; ")}`
          : null,
      );
      transferOrderSelection.clearSelection();
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setActionSuccessMessage(null);
      setActionErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    bulkArchiveMutation,
    actionErrorMessage,
    actionSuccessMessage,
    completeTaskMutation,
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    defaultTransferOrderCreateValues,
    generateTaskMutation,
    replenishmentRulesQuery,
    replenishmentRulesView,
    replenishmentTasksQuery,
    replenishmentTasksView,
    transferLinesQuery,
    transferLinesView,
    transferOrderSelection,
    transferOrdersQuery,
    transferOrdersView,
  };
}

export function useTransferOrderDetailController(
  transferOrderId: string | undefined,
) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const transferOrderQuery = useResource<TransferOrderRecord>(
    ["transfers", "transfer-orders", transferOrderId],
    `${transfersApi.transferOrders}${transferOrderId}/`,
    undefined,
    { enabled: Boolean(transferOrderId) },
  );

  const updateMutation = useMutation({
    mutationFn: (values: TransferOrderEditValues) =>
      runTransferOrderUpdate(String(transferOrderId), values),
    onSuccess: async (transferOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Transfer order ${transferOrder.transfer_number} updated.`);
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => runTransferOrderArchive(String(transferOrderId)),
    onSuccess: async (transferOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Transfer order ${transferOrder.transfer_number} archived.`);
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const completeLineMutation = useMutation({
    mutationFn: (transferLineId: number) => runTransferLineComplete(transferLineId),
    onSuccess: async (line) => {
      setErrorMessage(null);
      setSuccessMessage(`Transfer line ${line.line_number} completed for ${line.goods_code}.`);
      await invalidateTransfersQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    archiveMutation,
    completeLineMutation,
    defaultValues: transferOrderQuery.data
      ? mapTransferOrderToEditValues(transferOrderQuery.data)
      : defaultTransferOrderEditValues,
    errorMessage,
    successMessage,
    transferOrderQuery,
    updateMutation,
  };
}
