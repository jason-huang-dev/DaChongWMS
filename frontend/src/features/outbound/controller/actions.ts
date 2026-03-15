import { allocateSalesOrder, cancelSalesOrder, createShipment, postScanPick, postScanShip, updateSalesOrder } from "@/features/outbound/model/api";
import { mapEditValuesToSalesOrderPayload } from "@/features/outbound/model/mappers";
import type { SalesOrderEditValues, ScanPickValues, ScanShipValues, ShipmentCreateValues } from "@/features/outbound/model/types";

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

export function runScanPick(values: ScanPickValues) {
  return postScanPick(values);
}

export function runScanShip(values: ScanShipValues) {
  return postScanShip(values);
}
