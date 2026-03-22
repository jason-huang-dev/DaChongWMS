import { cancelPurchaseOrder, createReceipt, postScanPutaway, postScanReceive, postScanSign, updatePurchaseOrder, uploadStockInImport } from "@/features/inbound/model/api";
import { mapEditValuesToPurchaseOrderPayload } from "@/features/inbound/model/mappers";
import type { PurchaseOrderEditValues, ReceiptCreateValues, ScanPutawayValues, ScanReceiveValues, ScanSignValues } from "@/features/inbound/model/types";

export function runPurchaseOrderUpdate(purchaseOrderId: string, values: PurchaseOrderEditValues) {
  return updatePurchaseOrder(purchaseOrderId, mapEditValuesToPurchaseOrderPayload(values));
}

export function runPurchaseOrderCancel(purchaseOrderId: string) {
  return cancelPurchaseOrder(purchaseOrderId);
}

export function runReceiptCreate(values: ReceiptCreateValues) {
  return createReceipt(values);
}

export function runScanReceive(values: ScanReceiveValues) {
  return postScanReceive(values);
}

export function runScanSign(values: ScanSignValues) {
  return postScanSign(values);
}

export function runScanPutaway(values: ScanPutawayValues) {
  return postScanPutaway(values);
}

export function runStockInImport(file: File) {
  return uploadStockInImport(file);
}
