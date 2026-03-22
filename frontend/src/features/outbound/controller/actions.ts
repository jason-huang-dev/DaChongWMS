import {
  allocateSalesOrder,
  cancelSalesOrder,
  createPackageExecution,
  createShipment,
  createShipmentDocument,
  createTrackingEvent,
  createWave,
  postScanPick,
  postScanShip,
  resolveShortPick,
  updateSalesOrder,
} from "@/features/outbound/model/api";
import { mapEditValuesToSalesOrderPayload } from "@/features/outbound/model/mappers";
import type {
  LogisticsTrackingValues,
  PackageExecutionValues,
  SalesOrderEditValues,
  ScanPickValues,
  ScanShipValues,
  ShipmentCreateValues,
  ShipmentDocumentValues,
  WaveCreateValues,
} from "@/features/outbound/model/types";

function parseSalesOrderIds(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item > 0);
}

export function runSalesOrderUpdate(salesOrderId: string, values: SalesOrderEditValues) {
  return updateSalesOrder(salesOrderId, mapEditValuesToSalesOrderPayload(values));
}

export function runSalesOrderAllocate(salesOrderId: string) {
  return allocateSalesOrder(salesOrderId);
}

export function runSalesOrderCancel(salesOrderId: string) {
  return cancelSalesOrder(salesOrderId);
}

export function runShipmentCreate(values: ShipmentCreateValues) {
  return createShipment(values);
}

export function runWaveCreate(values: WaveCreateValues) {
  return createWave({
    ...values,
    sales_order_ids: parseSalesOrderIds(values.sales_order_ids),
  });
}

export function runPackageExecutionCreate(values: PackageExecutionValues) {
  return createPackageExecution(values);
}

export function runShipmentDocumentCreate(values: ShipmentDocumentValues) {
  return createShipmentDocument(values);
}

export function runTrackingEventCreate(values: LogisticsTrackingValues) {
  return createTrackingEvent(values);
}

export function runScanPick(values: ScanPickValues) {
  return postScanPick(values);
}

export function runScanShip(values: ScanShipValues) {
  return postScanShip(values);
}

export function runShortPickResolve(shortPickId: number) {
  return resolveShortPick(shortPickId);
}
