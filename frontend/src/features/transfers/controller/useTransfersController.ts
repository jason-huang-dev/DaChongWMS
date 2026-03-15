import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

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
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

const pageSize = 8;

async function invalidateTransfersQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [
    ["transfers"],
    ["dashboard"],
    ["inventory"],
  ]);
}

export function useTransfersController() {
  const queryClient = useQueryClient();
  const [createSuccessMessage, setCreateSuccessMessage] = useState<string | null>(null);
  const [createErrorMessage, setCreateErrorMessage] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);
  const [actionErrorMessage, setActionErrorMessage] = useState<string | null>(null);

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
    1,
    pageSize,
  );
  const transferLinesQuery = usePaginatedResource<TransferLineRecord>(
    ["transfers", "transfer-lines"],
    transfersApi.transferLines,
    1,
    pageSize,
  );
  const replenishmentRulesQuery = usePaginatedResource<ReplenishmentRuleRecord>(
    ["transfers", "replenishment-rules"],
    transfersApi.replenishmentRules,
    1,
    pageSize,
  );
  const replenishmentTasksQuery = usePaginatedResource<ReplenishmentTaskRecord>(
    ["transfers", "replenishment-tasks"],
    transfersApi.replenishmentTasks,
    1,
    pageSize,
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

  return {
    actionErrorMessage,
    actionSuccessMessage,
    completeTaskMutation,
    createErrorMessage,
    createSuccessMessage,
    createTransferOrderMutation,
    defaultTransferOrderCreateValues,
    generateTaskMutation,
    replenishmentRulesQuery,
    replenishmentTasksQuery,
    transferLinesQuery,
    transferOrdersQuery,
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
