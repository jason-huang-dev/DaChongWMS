import { cancelPurchaseOrder, createReceipt, postScanPutaway, postScanReceive, updatePurchaseOrder } from "@/features/inbound/model/api";
import { mapEditValuesToPurchaseOrderPayload } from "@/features/inbound/model/mappers";
import type { PurchaseOrderEditValues, ReceiptCreateValues, ScanPutawayValues, ScanReceiveValues } from "@/features/inbound/model/types";

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

export function runScanPutaway(values: ScanPutawayValues) {
  return postScanPutaway(values);
}
