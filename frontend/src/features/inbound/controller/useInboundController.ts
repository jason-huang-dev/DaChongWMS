import { useEffect, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runPurchaseOrderCancel,
  runPurchaseOrderUpdate,
  runReceiptCreate,
  runScanPutaway,
  runScanReceive,
  runScanSign,
  runStockInImport,
} from "@/features/inbound/controller/actions";
import {
  buildStockInListQueryFilters,
  type StockInListFilters,
} from "@/features/inbound/model/stock-in-list-management";
import { defaultPurchaseOrderEditValues, defaultReceiptCreateValues, mapPurchaseOrderToEditValues } from "@/features/inbound/model/mappers";
import { inboundApi } from "@/features/inbound/model/api";
import type {
  AdvanceShipmentNoticeRecord,
  InboundImportBatchRecord,
  InboundSigningRecord,
  PurchaseOrderEditValues,
  PurchaseOrderRecord,
  PutawayTaskRecord,
  ReceiptCreateValues,
  ReceiptRecord,
  ScanPutawayValues,
  ScanReceiveValues,
  ScanSignValues,
} from "@/features/inbound/model/types";
import { returnsApi } from "@/features/returns/model/api";
import type { ReturnOrderRecord, ReturnReceiptRecord } from "@/features/returns/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface InboundControllerOptions {
  scopeOrderType?: string;
  initialAdvanceShipmentNoticeFilters?: {
    asn_number__icontains?: string;
    status?: string;
    status__in?: string;
  };
  initialPurchaseOrderFilters?: {
    po_number__icontains?: string;
    status?: string;
    status__in?: string;
    searchField?: StockInListFilters["searchField"];
    searchValue?: string;
    dateField?: StockInListFilters["dateField"];
    dateFrom?: string;
    dateTo?: string;
  };
  initialReceiptFilters?: {
    receipt_number__icontains?: string;
    status?: string;
  };
  initialSigningRecordFilters?: {
    signing_number__icontains?: string;
    carrier_name__icontains?: string;
  };
  initialImportBatchFilters?: {
    batch_number__icontains?: string;
    status?: string;
  };
  initialPutawayTaskFilters?: {
    task_number__icontains?: string;
    status?: string;
    status__in?: string;
  };
  initialReturnOrderFilters?: {
    return_number__icontains?: string;
    status?: string;
    status__in?: string;
  };
}

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

export function useInboundController(options: InboundControllerOptions = {}) {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const scopedOrderType = options.scopeOrderType ?? undefined;
  const scopeViewKey = scopedOrderType ?? "all";
  const scopedQuery = {
    warehouse: activeWarehouseId ?? undefined,
    ...(scopedOrderType ? { order_type: scopedOrderType } : {}),
  };
  const [receiptSuccessMessage, setReceiptSuccessMessage] = useState<string | null>(null);
  const [receiptErrorMessage, setReceiptErrorMessage] = useState<string | null>(null);
  const [importBatchSuccessMessage, setImportBatchSuccessMessage] = useState<string | null>(null);
  const [importBatchErrorMessage, setImportBatchErrorMessage] = useState<string | null>(null);

  const advanceShipmentNoticesView = useDataView({
    viewKey: `inbound.asns.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      asn_number__icontains: options.initialAdvanceShipmentNoticeFilters?.asn_number__icontains ?? "",
      status: options.initialAdvanceShipmentNoticeFilters?.status ?? "",
      status__in: options.initialAdvanceShipmentNoticeFilters?.status__in ?? "",
    },
    pageSize: 8,
  });
  const purchaseOrdersView = useDataView({
    viewKey: `inbound.purchase-orders.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      po_number__icontains: options.initialPurchaseOrderFilters?.po_number__icontains ?? "",
      status: options.initialPurchaseOrderFilters?.status ?? "",
      status__in: options.initialPurchaseOrderFilters?.status__in ?? "",
      searchField: options.initialPurchaseOrderFilters?.searchField ?? "",
      searchValue: options.initialPurchaseOrderFilters?.searchValue ?? "",
      dateField: options.initialPurchaseOrderFilters?.dateField ?? "",
      dateFrom: options.initialPurchaseOrderFilters?.dateFrom ?? "",
      dateTo: options.initialPurchaseOrderFilters?.dateTo ?? "",
    },
    pageSize: 8,
  });
  const receiptsView = useDataView({
    viewKey: `inbound.receipts.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      receipt_number__icontains: options.initialReceiptFilters?.receipt_number__icontains ?? "",
      status: options.initialReceiptFilters?.status ?? "",
    },
    pageSize: 8,
  });
  const signingRecordsView = useDataView({
    viewKey: `inbound.signing-records.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      signing_number__icontains: options.initialSigningRecordFilters?.signing_number__icontains ?? "",
      carrier_name__icontains: options.initialSigningRecordFilters?.carrier_name__icontains ?? "",
    },
    pageSize: 8,
  });
  const importBatchesView = useDataView({
    viewKey: `inbound.import-batches.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      batch_number__icontains: options.initialImportBatchFilters?.batch_number__icontains ?? "",
      status: options.initialImportBatchFilters?.status ?? "",
    },
    pageSize: 8,
  });
  const putawayTasksView = useDataView({
    viewKey: `inbound.putaway-tasks.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      task_number__icontains: options.initialPutawayTaskFilters?.task_number__icontains ?? "",
      status: options.initialPutawayTaskFilters?.status ?? "",
      status__in: options.initialPutawayTaskFilters?.status__in ?? "",
    },
    pageSize: 8,
  });
  const returnOrdersView = useDataView({
    viewKey: `inbound.return-orders.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      return_number__icontains: options.initialReturnOrderFilters?.return_number__icontains ?? "",
      status: options.initialReturnOrderFilters?.status ?? "",
      status__in: options.initialReturnOrderFilters?.status__in ?? "",
    },
    pageSize: 6,
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

  const importBatchMutation = useMutation({
    mutationFn: (file: File) => runStockInImport(file),
    onSuccess: async (batch) => {
      setImportBatchErrorMessage(null);
      setImportBatchSuccessMessage(`${batch.batch_number}: ${batch.summary}`);
      await invalidateInboundQueries(queryClient, true);
    },
    onError: (error) => {
      setImportBatchSuccessMessage(null);
      setImportBatchErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    advanceShipmentNoticesQuery: usePaginatedResource<AdvanceShipmentNoticeRecord>(
      ["inbound", "advance-shipment-notices"],
      inboundApi.advanceShipmentNotices,
      advanceShipmentNoticesView.page,
      advanceShipmentNoticesView.pageSize,
      {
        ...scopedQuery,
        ...advanceShipmentNoticesView.queryFilters,
      },
    ),
    advanceShipmentNoticesView,
    createReceiptMutation,
    defaultReceiptCreateValues,
    importBatchErrorMessage,
    importBatchMutation,
    importBatchSuccessMessage,
    importBatchesQuery: usePaginatedResource<InboundImportBatchRecord>(
      ["inbound", "import-batches"],
      inboundApi.importBatches,
      importBatchesView.page,
      importBatchesView.pageSize,
      importBatchesView.queryFilters,
    ),
    importBatchesView,
    overduePurchaseOrdersQuery: usePaginatedResource<PurchaseOrderRecord>(
      ["inbound", "purchase-orders", "overdue"],
      inboundApi.purchaseOrders,
      1,
      25,
      {
        ...scopedQuery,
        expected_arrival_date__lte: new Date().toISOString().slice(0, 10),
      },
    ),
    purchaseOrdersQuery: usePaginatedResource<PurchaseOrderRecord>(
      ["inbound", "purchase-orders"],
      inboundApi.purchaseOrders,
      purchaseOrdersView.page,
      purchaseOrdersView.pageSize,
      {
        ...scopedQuery,
        ...buildStockInListQueryFilters(purchaseOrdersView.filters),
      },
    ),
    purchaseOrdersView,
    putawayTasksQuery: usePaginatedResource<PutawayTaskRecord>(
      ["inbound", "putaway-tasks"],
      inboundApi.putawayTasks,
      putawayTasksView.page,
      putawayTasksView.pageSize,
      {
        ...scopedQuery,
        ...putawayTasksView.queryFilters,
      },
    ),
    putawayTasksView,
    receiptErrorMessage,
    receiptSuccessMessage,
    receiptsQuery: usePaginatedResource<ReceiptRecord>(
      ["inbound", "receipts"],
      inboundApi.receipts,
      receiptsView.page,
      receiptsView.pageSize,
      {
        ...scopedQuery,
        ...receiptsView.queryFilters,
      },
    ),
    receiptsView,
    returnOrdersQuery: usePaginatedResource<ReturnOrderRecord>(
      ["inbound", "return-orders"],
      returnsApi.returnOrders,
      returnOrdersView.page,
      returnOrdersView.pageSize,
      {
        warehouse: activeWarehouseId ?? undefined,
        ...returnOrdersView.queryFilters,
      },
    ),
    returnOrdersView,
    returnReceiptsQuery: usePaginatedResource<ReturnReceiptRecord>(
      ["inbound", "return-receipts"],
      returnsApi.receipts,
      1,
      5,
      {
        warehouse: activeWarehouseId ?? undefined,
      },
    ),
    signingRecordsQuery: usePaginatedResource<InboundSigningRecord>(
      ["inbound", "signing-records"],
      inboundApi.signingRecords,
      signingRecordsView.page,
      signingRecordsView.pageSize,
      {
        ...scopedQuery,
        ...signingRecordsView.queryFilters,
      },
    ),
    signingRecordsView,
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
    cancelMutation,
    defaultValues: purchaseOrderQuery.data ? mapPurchaseOrderToEditValues(purchaseOrderQuery.data) : defaultPurchaseOrderEditValues,
    errorMessage,
    purchaseOrderQuery,
    successMessage,
    updateMutation,
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

  return { errorMessage, mutation, successMessage };
}

export function useScanSignController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ScanSignValues) => runScanSign(values),
    onSuccess: async (signingRecord) => {
      setErrorMessage(null);
      setSuccessMessage(`Signing record ${signingRecord.signing_number} captured for ${signingRecord.purchase_order_number}.`);
      await invalidateInboundQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { errorMessage, mutation, successMessage };
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

  return { errorMessage, mutation, successMessage };
}
