import { useEffect, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { runSalesOrderAllocate, runSalesOrderCancel, runSalesOrderUpdate, runScanPick, runScanShip, runShipmentCreate } from "@/features/outbound/controller/actions";
import { outboundApi } from "@/features/outbound/model/api";
import { defaultSalesOrderEditValues, defaultShipmentCreateValues, mapSalesOrderToEditValues } from "@/features/outbound/model/mappers";
import type { PickTaskRecord, SalesOrderEditValues, SalesOrderRecord, ScanPickValues, ScanShipValues, ShipmentCreateValues, ShipmentRecord } from "@/features/outbound/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

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

export function useOutboundController() {
  const queryClient = useQueryClient();
  const [shipmentSuccessMessage, setShipmentSuccessMessage] = useState<string | null>(null);
  const [shipmentErrorMessage, setShipmentErrorMessage] = useState<string | null>(null);

  const createShipmentMutation = useMutation({
    mutationFn: (values: ShipmentCreateValues) => runShipmentCreate(values),
    onSuccess: async (shipment) => {
      setShipmentErrorMessage(null);
      setShipmentSuccessMessage(`Shipment ${shipment.shipment_number} created for ${shipment.order_number}.`);
      await invalidateOutboundQueries(queryClient, true, true);
    },
    onError: (error) => {
      setShipmentSuccessMessage(null);
      setShipmentErrorMessage(parseApiError(error));
    },
  });

  return {
    createShipmentMutation,
    defaultShipmentCreateValues,
    salesOrdersQuery: usePaginatedResource<SalesOrderRecord>(["outbound", "sales-orders"], outboundApi.salesOrders, 1, 8),
    pickTasksQuery: usePaginatedResource<PickTaskRecord>(["outbound", "pick-tasks"], outboundApi.pickTasks, 1, 8),
    shipmentsQuery: usePaginatedResource<ShipmentRecord>(["outbound", "shipments"], outboundApi.shipments, 1, 8),
    shipmentErrorMessage,
    shipmentSuccessMessage,
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

export function useScanPickController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ScanPickValues) => runScanPick(values),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Pick task ${task.task_number} completed for ${task.goods_code}.`);
      await invalidateOutboundQueries(queryClient, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { mutation, successMessage, errorMessage };
}

export function useScanShipController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mutation = useMutation({
    mutationFn: (values: ScanShipValues) => runScanShip(values),
    onSuccess: async (shipment) => {
      setErrorMessage(null);
      setSuccessMessage(`Shipment ${shipment.shipment_number} posted for order ${shipment.order_number}.`);
      await invalidateOutboundQueries(queryClient, true, true);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return { mutation, successMessage, errorMessage };
}
