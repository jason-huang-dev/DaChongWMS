import { useEffect, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runPackageExecutionCreate,
  runSalesOrderAllocate,
  runSalesOrderCancel,
  runSalesOrderUpdate,
  runScanPick,
  runScanShip,
  runShipmentCreate,
  runShipmentDocumentCreate,
  runShortPickResolve,
  runTrackingEventCreate,
  runWaveCreate,
} from "@/features/outbound/controller/actions";
import { outboundApi } from "@/features/outbound/model/api";
import { defaultSalesOrderEditValues, defaultShipmentCreateValues, mapSalesOrderToEditValues } from "@/features/outbound/model/mappers";
import type {
  DockLoadVerificationRecord,
  LogisticsTrackingEventRecord,
  LogisticsTrackingValues,
  OutboundWaveRecord,
  PackageExecutionRecord,
  PackageExecutionValues,
  PickTaskRecord,
  SalesOrderEditValues,
  SalesOrderRecord,
  ScanPickValues,
  ScanShipValues,
  ShipmentCreateValues,
  ShipmentDocumentRecord,
  ShipmentDocumentValues,
  ShipmentRecord,
  ShortPickRecord,
  WaveCreateValues,
} from "@/features/outbound/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface OutboundControllerOptions {
  scopeOrderType?: string;
  initialSalesOrderFilters?: {
    order_number__icontains?: string;
    requested_ship_date__gte?: string;
    requested_ship_date__lte?: string;
    status?: string;
    status__in?: string;
    fulfillment_stage?: string;
    exception_state?: string;
    waybill_printed?: string;
  };
  initialPickTaskFilters?: {
    task_number__icontains?: string;
    status?: string;
    status__in?: string;
  };
  initialShipmentFilters?: {
    shipment_number__icontains?: string;
    status?: string;
  };
  initialDockLoadFilters?: {
    search?: string;
    status?: string;
  };
}

interface OutboundMutationOptions<TValues, TResult> {
  mutationFn: (values: TValues) => Promise<TResult>;
  getSuccessMessage: (result: TResult) => string;
  includeInventory?: boolean;
  includeFinance?: boolean;
}

async function invalidateOutboundQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  includeInventory = false,
  includeFinance = false,
) {
  await invalidateQueryGroups(queryClient, [
    ["outbound"],
    ["dashboard"],
    ...(includeInventory ? [["inventory"]] : []),
    ...(includeFinance ? [["finance"]] : []),
  ]);
}

function useOutboundMutation<TValues, TResult>({
  mutationFn,
  getSuccessMessage,
  includeInventory = false,
  includeFinance = false,
}: OutboundMutationOptions<TValues, TResult>) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn,
    onSuccess: async (result) => {
      setErrorMessage(null);
      setSuccessMessage(getSuccessMessage(result));
      await invalidateOutboundQueries(queryClient, includeInventory, includeFinance);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { mutation, successMessage, errorMessage };
}

export function useOutboundController(options: OutboundControllerOptions = {}) {
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const scopedOrderType = options.scopeOrderType ?? undefined;
  const scopeViewKey = scopedOrderType ?? "all";
  const scopedQuery = {
    warehouse: activeWarehouseId ?? undefined,
    ...(scopedOrderType ? { order_type: scopedOrderType } : {}),
  };
  const salesOrdersView = useDataView({
    viewKey: `outbound.sales-orders.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      order_number__icontains: options.initialSalesOrderFilters?.order_number__icontains ?? "",
      requested_ship_date__gte: options.initialSalesOrderFilters?.requested_ship_date__gte ?? "",
      requested_ship_date__lte: options.initialSalesOrderFilters?.requested_ship_date__lte ?? "",
      status: options.initialSalesOrderFilters?.status ?? "",
      status__in: options.initialSalesOrderFilters?.status__in ?? "",
      fulfillment_stage: options.initialSalesOrderFilters?.fulfillment_stage ?? "",
      exception_state: options.initialSalesOrderFilters?.exception_state ?? "",
      waybill_printed: options.initialSalesOrderFilters?.waybill_printed ?? "",
    },
    pageSize: 8,
  });
  const pickTasksView = useDataView({
    viewKey: `outbound.pick-tasks.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      task_number__icontains: options.initialPickTaskFilters?.task_number__icontains ?? "",
      status: options.initialPickTaskFilters?.status ?? "",
      status__in: options.initialPickTaskFilters?.status__in ?? "",
    },
    pageSize: 8,
  });
  const shipmentsView = useDataView({
    viewKey: `outbound.shipments.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      shipment_number__icontains: options.initialShipmentFilters?.shipment_number__icontains ?? "",
      status: options.initialShipmentFilters?.status ?? "",
    },
    pageSize: 8,
  });
  const dockLoadView = useDataView({
    viewKey: `outbound.dock-load.${company?.openid ?? "anonymous"}.${scopeViewKey}`,
    defaultFilters: {
      search: options.initialDockLoadFilters?.search ?? "",
      status: options.initialDockLoadFilters?.status ?? "",
    },
    pageSize: 8,
  });

  return {
    activeWarehouse,
    defaultShipmentCreateValues,
    salesOrdersView,
    salesOrderStatusCounts: {
      all: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "all"],
        outboundApi.salesOrders,
        1,
        1,
        scopedQuery,
      ),
      open: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "open"],
        outboundApi.salesOrders,
        1,
        1,
        { ...scopedQuery, status: "OPEN" },
      ),
      allocated: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "allocated"],
        outboundApi.salesOrders,
        1,
        1,
        { ...scopedQuery, status: "ALLOCATED" },
      ),
      picked: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "picked"],
        outboundApi.salesOrders,
        1,
        1,
        { ...scopedQuery, status: "PICKED" },
      ),
      shipped: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "shipped"],
        outboundApi.salesOrders,
        1,
        1,
        { ...scopedQuery, status: "SHIPPED" },
      ),
      cancelled: usePaginatedResource<SalesOrderRecord>(
        ["outbound", "sales-orders", "count", "cancelled"],
        outboundApi.salesOrders,
        1,
        1,
        { ...scopedQuery, status: "CANCELLED" },
      ),
    },
    salesOrdersQuery: usePaginatedResource<SalesOrderRecord>(
      ["outbound", "sales-orders"],
      outboundApi.salesOrders,
      salesOrdersView.page,
      salesOrdersView.pageSize,
      {
        ...scopedQuery,
        ...salesOrdersView.queryFilters,
      },
    ),
    interceptionOrdersQuery: usePaginatedResource<SalesOrderRecord>(
      ["outbound", "sales-orders", "interceptions"],
      outboundApi.salesOrders,
      1,
      6,
      {
        ...scopedQuery,
        exception_state: "ORDER_INTERCEPTION",
      },
    ),
    abnormalPackagesQuery: usePaginatedResource<SalesOrderRecord>(
      ["outbound", "sales-orders", "abnormal-packages"],
      outboundApi.salesOrders,
      1,
      6,
      {
        ...scopedQuery,
        exception_state: "ABNORMAL_PACKAGE",
      },
    ),
    pickTasksView,
    pickTasksQuery: usePaginatedResource<PickTaskRecord>(
      ["outbound", "pick-tasks"],
      outboundApi.pickTasks,
      pickTasksView.page,
      pickTasksView.pageSize,
      {
        ...scopedQuery,
        ...pickTasksView.queryFilters,
      },
    ),
    wavesQuery: usePaginatedResource<OutboundWaveRecord>(
      ["outbound", "waves"],
      outboundApi.waves,
      1,
      8,
      scopedQuery,
    ),
    packageExecutionsQuery: usePaginatedResource<PackageExecutionRecord>(
      ["outbound", "package-executions"],
      outboundApi.packageExecutions,
      1,
      8,
      scopedQuery,
    ),
    shipmentsView,
    shipmentsQuery: usePaginatedResource<ShipmentRecord>(
      ["outbound", "shipments"],
      outboundApi.shipments,
      shipmentsView.page,
      shipmentsView.pageSize,
      {
        ...scopedQuery,
        ...shipmentsView.queryFilters,
      },
    ),
    manifestDocumentsQuery: usePaginatedResource<ShipmentDocumentRecord>(
      ["outbound", "shipment-documents", "manifest"],
      outboundApi.shipmentDocuments,
      1,
      5,
      {
        ...scopedQuery,
        document_type: "MANIFEST",
      },
    ),
    photoDocumentsQuery: usePaginatedResource<ShipmentDocumentRecord>(
      ["outbound", "shipment-documents", "photo"],
      outboundApi.shipmentDocuments,
      1,
      5,
      {
        ...scopedQuery,
        document_type: "PHOTO",
      },
    ),
    scanformDocumentsQuery: usePaginatedResource<ShipmentDocumentRecord>(
      ["outbound", "shipment-documents", "scanform"],
      outboundApi.shipmentDocuments,
      1,
      5,
      {
        ...scopedQuery,
        document_type: "SCANFORM",
      },
    ),
    trackingEventsQuery: usePaginatedResource<LogisticsTrackingEventRecord>(
      ["outbound", "tracking-events"],
      outboundApi.trackingEvents,
      1,
      8,
      scopedQuery,
    ),
    dockLoadView,
    dockLoadVerificationsQuery: usePaginatedResource<DockLoadVerificationRecord>(
      ["outbound", "dock-load-verifications"],
      outboundApi.dockLoadVerifications,
      dockLoadView.page,
      dockLoadView.pageSize,
      {
        ...scopedQuery,
        ...dockLoadView.queryFilters,
      },
    ),
    shortPicksQuery: usePaginatedResource<ShortPickRecord>(
      ["outbound", "short-picks", "exceptions"],
      outboundApi.shortPicks,
      1,
      25,
      {
        ...scopedQuery,
        status: "OPEN",
      },
    ),
  };
}

export function useSalesOrderDetailController(salesOrderId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const salesOrderQuery = useResource<SalesOrderRecord>(
    ["outbound", "sales-orders", salesOrderId],
    `${outboundApi.salesOrders}${salesOrderId}/`,
    undefined,
    { enabled: Boolean(salesOrderId) },
  );

  useEffect(() => {
    if (!salesOrderQuery.data) {
      return;
    }
    setSuccessMessage(null);
    setErrorMessage(null);
  }, [salesOrderQuery.data]);

  const updateMutation = useMutation({
    mutationFn: (values: SalesOrderEditValues) => runSalesOrderUpdate(String(salesOrderId), values),
    onSuccess: async (salesOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Sales order ${salesOrder.order_number} updated.`);
      await invalidateOutboundQueries(queryClient, true, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const allocateMutation = useMutation({
    mutationFn: () => runSalesOrderAllocate(String(salesOrderId)),
    onSuccess: async (salesOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Sales order ${salesOrder.order_number} allocated.`);
      await invalidateOutboundQueries(queryClient, true, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => runSalesOrderCancel(String(salesOrderId)),
    onSuccess: async (salesOrder) => {
      setErrorMessage(null);
      setSuccessMessage(`Sales order ${salesOrder.order_number} cancelled.`);
      await invalidateOutboundQueries(queryClient, true, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    salesOrderQuery,
    updateMutation,
    allocateMutation,
    cancelMutation,
    successMessage,
    errorMessage,
    defaultValues: salesOrderQuery.data ? mapSalesOrderToEditValues(salesOrderQuery.data) : defaultSalesOrderEditValues,
  };
}

export function useWaveCreateController() {
  return useOutboundMutation<WaveCreateValues, OutboundWaveRecord>({
    mutationFn: runWaveCreate,
    getSuccessMessage: (wave) => `Wave ${wave.wave_number} created with ${wave.order_count} orders.`,
  });
}

export function usePackageExecutionController() {
  return useOutboundMutation<PackageExecutionValues, PackageExecutionRecord>({
    mutationFn: runPackageExecutionCreate,
    getSuccessMessage: (record) => `${record.step_type} recorded for package ${record.package_number}.`,
  });
}

export function useShipmentDocumentController() {
  return useOutboundMutation<ShipmentDocumentValues, ShipmentDocumentRecord>({
    mutationFn: runShipmentDocumentCreate,
    getSuccessMessage: (record) => `${record.document_type} ${record.document_number} generated.`,
  });
}

export function useTrackingEventController() {
  return useOutboundMutation<LogisticsTrackingValues, LogisticsTrackingEventRecord>({
    mutationFn: runTrackingEventCreate,
    getSuccessMessage: (event) => `Tracking event ${event.event_number} recorded for ${event.tracking_number}.`,
  });
}

export function useScanPickController() {
  return useOutboundMutation<ScanPickValues, PickTaskRecord>({
    mutationFn: runScanPick,
    getSuccessMessage: (task) => `Pick task ${task.task_number} completed for ${task.goods_code}.`,
    includeInventory: true,
  });
}

export function useScanShipController() {
  return useOutboundMutation<ScanShipValues, ShipmentRecord>({
    mutationFn: runScanShip,
    getSuccessMessage: (shipment) => `Shipment ${shipment.shipment_number} posted for order ${shipment.order_number}.`,
    includeInventory: true,
    includeFinance: true,
  });
}

export function useCreateShipmentController() {
  return useOutboundMutation<ShipmentCreateValues, ShipmentRecord>({
    mutationFn: runShipmentCreate,
    getSuccessMessage: (shipment) => `Shipment ${shipment.shipment_number} created for ${shipment.order_number}.`,
    includeInventory: true,
    includeFinance: true,
  });
}

export function useShortPickResolveController() {
  return useOutboundMutation<number, ShortPickRecord>({
    mutationFn: runShortPickResolve,
    getSuccessMessage: (shortPick) => `Short-pick ${shortPick.order_number} / ${shortPick.goods_code} marked resolved.`,
    includeInventory: true,
  });
}
