import { apiDelete, apiPatch, apiPost } from "@/lib/http";

import type {
  ReturnDispositionCreateValues,
  ReturnDispositionRecord,
  ReturnOrderCreatePayload,
  ReturnOrderRecord,
  ReturnOrderUpdatePayload,
  ReturnReceiptCreateValues,
  ReturnReceiptRecord,
} from "./types";

export const returnsApi = {
  dispositions: "/api/returns/dispositions/",
  receipts: "/api/returns/receipts/",
  returnOrders: "/api/returns/return-orders/",
} as const;

export function createReturnOrder(values: ReturnOrderCreatePayload) {
  return apiPost<ReturnOrderRecord>(returnsApi.returnOrders, values);
}

export function updateReturnOrder(
  returnOrderId: string,
  values: ReturnOrderUpdatePayload,
) {
  return apiPatch<ReturnOrderRecord>(
    `${returnsApi.returnOrders}${returnOrderId}/`,
    values,
  );
}

export function archiveReturnOrder(returnOrderId: string) {
  return apiDelete<ReturnOrderRecord>(`${returnsApi.returnOrders}${returnOrderId}/`);
}

export function createReturnReceipt(values: ReturnReceiptCreateValues) {
  return apiPost<ReturnReceiptRecord>(returnsApi.receipts, values);
}

export function createReturnDisposition(values: ReturnDispositionCreateValues) {
  return apiPost<ReturnDispositionRecord>(returnsApi.dispositions, values);
}
