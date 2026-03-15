import { apiGet, apiPatch, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  PurchaseOrderRecord,
  PurchaseOrderUpdatePayload,
  PutawayTaskRecord,
  ReceiptCreateValues,
  ReceiptRecord,
  ScanPutawayValues,
  ScanReceiveValues,
} from "./types";

export const inboundApi = {
  purchaseOrders: "/api/inbound/purchase-orders/",
  receipts: "/api/inbound/receipts/",
  putawayTasks: "/api/inbound/putaway-tasks/",
} as const;

export function listPurchaseOrders(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PurchaseOrderRecord>>(inboundApi.purchaseOrders, { page, page_size: pageSize });
}

export function listReceipts(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ReceiptRecord>>(inboundApi.receipts, { page, page_size: pageSize });
}

export function listPutawayTasks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PutawayTaskRecord>>(inboundApi.putawayTasks, { page, page_size: pageSize });
}

export function fetchPurchaseOrder(purchaseOrderId: string) {
  return apiGet<PurchaseOrderRecord>(`${inboundApi.purchaseOrders}${purchaseOrderId}/`);
}

export function createReceipt(values: ReceiptCreateValues) {
  return apiPost<ReceiptRecord>(inboundApi.receipts, values);
}

export function updatePurchaseOrder(
  purchaseOrderId: string,
  values: PurchaseOrderUpdatePayload,
) {
  return apiPatch<PurchaseOrderRecord>(`${inboundApi.purchaseOrders}${purchaseOrderId}/`, values);
}

export function cancelPurchaseOrder(purchaseOrderId: string) {
  return apiPatch<PurchaseOrderRecord>(`${inboundApi.purchaseOrders}${purchaseOrderId}/`, { status: "CANCELLED" });
}

export function postScanReceive(values: ScanReceiveValues) {
  return apiPost<ReceiptRecord>(`${inboundApi.receipts}scan-receive/`, values);
}

export function postScanPutaway(values: ScanPutawayValues) {
  return apiPost<PutawayTaskRecord>(`${inboundApi.putawayTasks}scan-complete/`, values);
}
