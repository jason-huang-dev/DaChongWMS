import { apiGet, apiPatch, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  PickTaskRecord,
  SalesOrderRecord,
  SalesOrderUpdatePayload,
  ScanPickValues,
  ScanShipValues,
  ShipmentCreateValues,
  ShipmentRecord,
} from "./types";

export const outboundApi = {
  salesOrders: "/api/outbound/sales-orders/",
  pickTasks: "/api/outbound/pick-tasks/",
  shipments: "/api/outbound/shipments/",
} as const;

export function listSalesOrders(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<SalesOrderRecord>>(outboundApi.salesOrders, { page, page_size: pageSize });
}

export function listPickTasks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PickTaskRecord>>(outboundApi.pickTasks, { page, page_size: pageSize });
}

export function listShipments(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ShipmentRecord>>(outboundApi.shipments, { page, page_size: pageSize });
}

export function fetchSalesOrder(salesOrderId: string) {
  return apiGet<SalesOrderRecord>(`${outboundApi.salesOrders}${salesOrderId}/`);
}

export function createShipment(values: ShipmentCreateValues) {
  return apiPost<ShipmentRecord>(outboundApi.shipments, values);
}

export function updateSalesOrder(
  salesOrderId: string,
  values: SalesOrderUpdatePayload,
) {
  return apiPatch<SalesOrderRecord>(`${outboundApi.salesOrders}${salesOrderId}/`, values);
}

export function allocateSalesOrder(salesOrderId: string) {
  return apiPost<SalesOrderRecord>(`${outboundApi.salesOrders}${salesOrderId}/allocate/`, {});
}

export function cancelSalesOrder(salesOrderId: string) {
  return apiPatch<SalesOrderRecord>(`${outboundApi.salesOrders}${salesOrderId}/`, { status: "CANCELLED" });
}

export function postScanPick(values: ScanPickValues) {
  return apiPost<PickTaskRecord>(`${outboundApi.pickTasks}scan-complete/`, values);
}

export function postScanShip(values: ScanShipValues) {
  return apiPost<ShipmentRecord>(`${outboundApi.shipments}scan-ship/`, values);
}
