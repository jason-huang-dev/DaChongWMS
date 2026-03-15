import { useEffect, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import { runPurchaseOrderCancel, runPurchaseOrderUpdate, runReceiptCreate, runScanPutaway, runScanReceive } from "@/features/inbound/controller/actions";
import { defaultPurchaseOrderEditValues, defaultReceiptCreateValues, mapPurchaseOrderToEditValues } from "@/features/inbound/model/mappers";
import type { PurchaseOrderEditValues, PurchaseOrderRecord, PutawayTaskRecord, ReceiptCreateValues, ReceiptRecord, ScanPutawayValues, ScanReceiveValues } from "@/features/inbound/model/types";
import { inboundApi } from "@/features/inbound/model/api";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateInboundQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  includeInventory = false,
) {
  await invalidateQueryGroups(queryClient, [
    ["inbound"],
    ["dashboard"],
    ...(includeInventory ? [["inventory"]] : []),
  ]);
}

export function useInboundController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const [receiptSuccessMessage, setReceiptSuccessMessage] = useState<string | null>(null);
  const [receiptErrorMessage, setReceiptErrorMessage] = useState<string | null>(null);
  const purchaseOrdersView = useDataView({
    viewKey: `inbound.purchase-orders.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      po_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const receiptsView = useDataView({
    viewKey: `inbound.receipts.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      receipt_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const putawayTasksView = useDataView({
    viewKey: `inbound.putaway-tasks.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      task_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });

  const createReceiptMutation = useMutation({
    mutationFn: (values: ReceiptCreateValues) => runReceiptCreate(values),
    onSuccess: async (receipt) => {
      setReceiptErrorMessage(null);
      setReceiptSuccessMessage(`Receipt ${receipt.receipt_number} created for ${receipt.purchase_order_number}.`);
      await invalidateInboundQueries(queryClient, true);
    },
    onError: (error) => {
      setReceiptSuccessMessage(null);
      setReceiptErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    createReceiptMutation,
    defaultReceiptCreateValues,
    overduePurchaseOrdersQuery: usePaginatedResource<PurchaseOrderRecord>(
      ["inbound", "purchase-orders", "overdue"],
      inboundApi.purchaseOrders,
      1,
      25,
      {
        warehouse: activeWarehouseId ?? undefined,
        expected_arrival_date__lte: new Date().toISOString().slice(0, 10),
      },
    ),
    purchaseOrdersView,
    purchaseOrdersQuery: usePaginatedResource<PurchaseOrderRecord>(
      ["inbound", "purchase-orders"],
      inboundApi.purchaseOrders,
      purchaseOrdersView.page,
      purchaseOrdersView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...purchaseOrdersView.queryFilters,
      },
    ),
    receiptsView,
    receiptsQuery: usePaginatedResource<ReceiptRecord>(
      ["inbound", "receipts"],
      inboundApi.receipts,
      receiptsView.page,
      receiptsView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...receiptsView.queryFilters,
      },
    ),
    putawayTasksView,
    putawayTasksQuery: usePaginatedResource<PutawayTaskRecord>(
      ["inbound", "putaway-tasks"],
      inboundApi.putawayTasks,
      putawayTasksView.page,
      putawayTasksView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...putawayTasksView.queryFilters,
      },
    ),
    receiptErrorMessage,
    receiptSuccessMessage,
  };
}

export function usePurchaseOrderDetailController(purchaseOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const purchaseOrderQuery = useResource<PurchaseOrderRecord>(
    ["inbound", "purchase-orders", purchaseOrderId],
    `${inboundApi.purchaseOrders}${purchaseOrderId}/`,
    undefined,
    { enabled: Boolean(purchaseOrderId) },
  );

  useEffect(() => {
    if (!purchaseOrderQuery.data) {
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [purchaseOrderQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (values: PurchaseOrderEditValues) => runPurchaseOrderUpdate(String(purchaseOrderId), values),
    onSuccess: async (purchaseOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Purchase order ${purchaseOrder.po_number} updated.`);
      await invalidateInboundQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => runPurchaseOrderCancel(String(purchaseOrderId)),
    onSuccess: async (purchaseOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Purchase order ${purchaseOrder.po_number} cancelled.`);
      await invalidateInboundQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    purchaseOrderQuery,
    updateMutation,
    cancelMutation,
    successMessage,
    errorMessage,
    defaultValues: purchaseOrderQuery.data ? mapPurchaseOrderToEditValues(purchaseOrderQuery.data) : defaultPurchaseOrderEditValues,
  };
}

export function useScanReceiveController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ScanReceiveValues) => runScanReceive(values),
    onSuccess: async (receipt) => {
      setErrorMessage(null);
      setSuccessMessage(`Receipt ${receipt.receipt_number} posted to ${receipt.receipt_location_code}.`);
      await invalidateInboundQueries(queryClient, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { mutation, successMessage, errorMessage };
}

export function useScanPutawayController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ScanPutawayValues) => runScanPutaway(values),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Putaway task ${task.task_number} completed to ${task.to_location_code || "destination"}.`);
      await invalidateInboundQueries(queryClient, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { mutation, successMessage, errorMessage };
}
