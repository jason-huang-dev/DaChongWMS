import { apiGet, apiPatch, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  DockLoadVerificationRecord,
  LogisticsTrackingEventRecord,
  OutboundWaveRecord,
  PackageExecutionRecord,
  PickTaskRecord,
  SalesOrderRecord,
  ShipmentDocumentRecord,
  SalesOrderUpdatePayload,
  LogisticsTrackingValues,
  PackageExecutionValues,
  ScanPickValues,
  ScanShipValues,
  ShipmentCreateValues,
  ShipmentDocumentValues,
  ShipmentRecord,
  ShortPickRecord,
  WaveCreateValues,
} from "./types";

export const outboundApi = {
  salesOrders: "/api/outbound/sales-orders/",
  pickTasks: "/api/outbound/pick-tasks/",
  shipments: "/api/outbound/shipments/",
  waves: "/api/outbound/waves/",
  packageExecutions: "/api/outbound/package-executions/",
  shipmentDocuments: "/api/outbound/shipment-documents/",
  trackingEvents: "/api/outbound/tracking-events/",
  shortPicks: "/api/outbound/short-picks/",
  dockLoadVerifications: "/api/outbound/dock-load-verifications/",
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

export function listWaves(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<OutboundWaveRecord>>(outboundApi.waves, { page, page_size: pageSize });
}

export function listPackageExecutions(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PackageExecutionRecord>>(outboundApi.packageExecutions, { page, page_size: pageSize });
}

export function listShipmentDocuments(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ShipmentDocumentRecord>>(outboundApi.shipmentDocuments, { page, page_size: pageSize });
}

export function listTrackingEvents(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<LogisticsTrackingEventRecord>>(outboundApi.trackingEvents, { page, page_size: pageSize });
}

export function listShortPicks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ShortPickRecord>>(outboundApi.shortPicks, { page, page_size: pageSize });
}

export function listDockLoadVerifications(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<DockLoadVerificationRecord>>(outboundApi.dockLoadVerifications, { page, page_size: pageSize });
}

export function fetchSalesOrder(salesOrderId: string) {
  return apiGet<SalesOrderRecord>(`${outboundApi.salesOrders}${salesOrderId}/`);
}

export function createShipment(values: ShipmentCreateValues) {
  return apiPost<ShipmentRecord>(outboundApi.shipments, values);
}

export function createWave(values: Omit<WaveCreateValues, "sales_order_ids"> & { sales_order_ids: number[] }) {
  return apiPost<OutboundWaveRecord>(outboundApi.waves, values);
}

export function createPackageExecution(values: PackageExecutionValues) {
  return apiPost<PackageExecutionRecord>(outboundApi.packageExecutions, values);
}

export function createShipmentDocument(values: ShipmentDocumentValues) {
  return apiPost<ShipmentDocumentRecord>(outboundApi.shipmentDocuments, values);
}

export function createTrackingEvent(values: LogisticsTrackingValues) {
  return apiPost<LogisticsTrackingEventRecord>(outboundApi.trackingEvents, values);
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

export function resolveShortPick(shortPickId: number, resolution_notes = "") {
  return apiPost<ShortPickRecord>(`${outboundApi.shortPicks}${shortPickId}/resolve/`, { resolution_notes });
}
