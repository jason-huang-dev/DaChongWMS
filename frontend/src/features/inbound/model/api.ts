import { apiGet, apiPatch, apiPost, apiPostForm } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  AdvanceShipmentNoticeRecord,
  InboundImportBatchRecord,
  InboundSigningRecord,
  PurchaseOrderRecord,
  PurchaseOrderUpdatePayload,
  PutawayTaskRecord,
  ReceiptCreateValues,
  ReceiptRecord,
  ScanPutawayValues,
  ScanReceiveValues,
  ScanSignValues,
} from "./types";

export const inboundApi = {
  advanceShipmentNotices: "/api/inbound/advance-shipment-notices/",
  importBatches: "/api/inbound/import-batches/",
  purchaseOrders: "/api/inbound/purchase-orders/",
  receipts: "/api/inbound/receipts/",
  signingRecords: "/api/inbound/signing-records/",
  putawayTasks: "/api/inbound/putaway-tasks/",
} as const;

export function listAdvanceShipmentNotices(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<AdvanceShipmentNoticeRecord>>(inboundApi.advanceShipmentNotices, { page, page_size: pageSize });
}

export function listPurchaseOrders(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PurchaseOrderRecord>>(inboundApi.purchaseOrders, { page, page_size: pageSize });
}

export function listReceipts(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ReceiptRecord>>(inboundApi.receipts, { page, page_size: pageSize });
}

export function listSigningRecords(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<InboundSigningRecord>>(inboundApi.signingRecords, { page, page_size: pageSize });
}

export function listPutawayTasks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<PutawayTaskRecord>>(inboundApi.putawayTasks, { page, page_size: pageSize });
}

export function listImportBatches(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<InboundImportBatchRecord>>(inboundApi.importBatches, { page, page_size: pageSize });
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

export function postScanSign(values: ScanSignValues) {
  return apiPost<InboundSigningRecord>(`${inboundApi.signingRecords}scan-sign/`, values);
}

export function postScanPutaway(values: ScanPutawayValues) {
  return apiPost<PutawayTaskRecord>(`${inboundApi.putawayTasks}scan-complete/`, values);
}

export function uploadStockInImport(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return apiPostForm<InboundImportBatchRecord>(`${inboundApi.importBatches}upload/`, formData);
}
