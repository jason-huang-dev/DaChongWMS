import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runReturnDispositionCreate,
  runReturnOrderCreate,
  runReturnOrderArchive,
  runReturnOrderUpdate,
  runReturnReceiptCreate,
} from "@/features/returns/controller/actions";
import {
  defaultReturnDispositionValues,
  defaultReturnOrderCreateValues,
  defaultReturnOrderEditValues,
  defaultReturnReceiptValues,
  mapReturnOrderToEditValues,
} from "@/features/returns/model/mappers";
import { returnsApi } from "@/features/returns/model/api";
import type {
  ReturnDispositionCreateValues,
  ReturnDispositionRecord,
  ReturnOrderCreateValues,
  ReturnOrderEditValues,
  ReturnOrderRecord,
  ReturnReceiptCreateValues,
  ReturnReceiptRecord,
  SalesOrderRecord,
} from "@/features/returns/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateReturnsQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [
    ["returns"],
    ["dashboard"],
    ["inventory"],
    ["finance"],
  ]);
}

export function useReturnsController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const [returnOrderSuccessMessage, setReturnOrderSuccessMessage] = useState<string | null>(null);
  const [returnOrderErrorMessage, setReturnOrderErrorMessage] = useState<string | null>(null);
  const [receiptSuccessMessage, setReceiptSuccessMessage] = useState<string | null>(null);
  const [receiptErrorMessage, setReceiptErrorMessage] = useState<string | null>(null);
  const [dispositionSuccessMessage, setDispositionSuccessMessage] = useState<string | null>(null);
  const [dispositionErrorMessage, setDispositionErrorMessage] = useState<string | null>(null);
  const returnOrdersView = useDataView({
    viewKey: `returns.return-orders.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      return_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const receiptsView = useDataView({
    viewKey: `returns.receipts.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      receipt_number__icontains: "",
      stock_status: "",
    },
    pageSize: 8,
  });
  const dispositionsView = useDataView({
    viewKey: `returns.dispositions.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      disposition_number__icontains: "",
      disposition_type: "",
    },
    pageSize: 8,
  });

  const returnOrdersQuery = usePaginatedResource<ReturnOrderRecord>(
    ["returns", "return-orders"],
    returnsApi.returnOrders,
    returnOrdersView.page,
    returnOrdersView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...returnOrdersView.queryFilters,
    },
  );
  const receiptsQuery = usePaginatedResource<ReturnReceiptRecord>(
    ["returns", "receipts"],
    returnsApi.receipts,
    receiptsView.page,
    receiptsView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...receiptsView.queryFilters,
    },
  );
  const dispositionsQuery = usePaginatedResource<ReturnDispositionRecord>(
    ["returns", "dispositions"],
    returnsApi.dispositions,
    dispositionsView.page,
    dispositionsView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...dispositionsView.queryFilters,
    },
  );

  const returnOrderMutation = useMutation({
    mutationFn: ({ salesOrder, values }: { values: ReturnOrderCreateValues; salesOrder: SalesOrderRecord }) =>
      runReturnOrderCreate(values, salesOrder),
    onSuccess: async (returnOrder) => {
      setReturnOrderErrorMessage(null);
      setReturnOrderSuccessMessage(`Return order ${returnOrder.return_number} created.`);
      await invalidateReturnsQueries(queryClient);
    },
    onError: (error) => {
      setReturnOrderSuccessMessage(null);
      setReturnOrderErrorMessage(parseApiError(error));
    },
  });

  const receiptMutation = useMutation({
    mutationFn: (values: ReturnReceiptCreateValues) => runReturnReceiptCreate(values),
    onSuccess: async (receipt) => {
      setReceiptErrorMessage(null);
      setReceiptSuccessMessage(
        `Return receipt ${receipt.receipt_number} posted for ${receipt.return_number}.`,
      );
      await invalidateReturnsQueries(queryClient);
    },
    onError: (error) => {
      setReceiptSuccessMessage(null);
      setReceiptErrorMessage(parseApiError(error));
    },
  });

  const dispositionMutation = useMutation({
    mutationFn: (values: ReturnDispositionCreateValues) =>
      runReturnDispositionCreate(values),
    onSuccess: async (disposition) => {
      setDispositionErrorMessage(null);
      setDispositionSuccessMessage(
        `Disposition ${disposition.disposition_number} completed for ${disposition.return_number}.`,
      );
      await invalidateReturnsQueries(queryClient);
    },
    onError: (error) => {
      setDispositionSuccessMessage(null);
      setDispositionErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    defaultReturnOrderCreateValues,
    defaultDispositionValues: defaultReturnDispositionValues,
    defaultReceiptValues: defaultReturnReceiptValues,
    dispositionErrorMessage,
    dispositionMutation,
    dispositionSuccessMessage,
    dispositionsQuery,
    dispositionsView,
    returnOrderErrorMessage,
    returnOrderMutation,
    returnOrderSuccessMessage,
    receiptErrorMessage,
    receiptMutation,
    receiptSuccessMessage,
    receiptsQuery,
    receiptsView,
    returnOrdersQuery,
    returnOrdersView,
  };
}

export function useReturnOrderDetailController(returnOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const returnOrderQuery = useResource<ReturnOrderRecord>(
    ["returns", "return-orders", returnOrderId],
    `${returnsApi.returnOrders}${returnOrderId}/`,
    undefined,
    { enabled: Boolean(returnOrderId) },
  );

  const updateMutation = useMutation({
    mutationFn: (values: ReturnOrderEditValues) =>
      runReturnOrderUpdate(String(returnOrderId), values),
    onSuccess: async (returnOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Return order ${returnOrder.return_number} updated.`);
      await invalidateReturnsQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: () => runReturnOrderArchive(String(returnOrderId)),
    onSuccess: async (returnOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Return order ${returnOrder.return_number} archived.`);
      await invalidateReturnsQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    archiveMutation,
    defaultValues: returnOrderQuery.data
      ? mapReturnOrderToEditValues(returnOrderQuery.data)
      : defaultReturnOrderEditValues,
    errorMessage,
    returnOrderQuery,
    successMessage,
    updateMutation,
  };
}
