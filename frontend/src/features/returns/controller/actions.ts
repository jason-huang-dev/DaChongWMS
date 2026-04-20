import {
  archiveReturnOrder,
  createReturnDisposition,
  createReturnOrder,
  createReturnReceipt,
  updateReturnOrder,
} from "@/features/returns/model/api";
import { mapCreateValuesToReturnOrderPayload, mapEditValuesToReturnOrderPayload } from "@/features/returns/model/mappers";

import type {
  ReturnDispositionCreateValues,
  ReturnOrderCreateValues,
  ReturnOrderEditValues,
  ReturnReceiptCreateValues,
  SalesOrderRecord,
} from "@/features/returns/model/types";

export function runReturnOrderCreate(values: ReturnOrderCreateValues, salesOrder: SalesOrderRecord) {
  return createReturnOrder(mapCreateValuesToReturnOrderPayload(values, salesOrder));
}

export function runReturnOrderUpdate(
  returnOrderId: string,
  values: ReturnOrderEditValues,
) {
  return updateReturnOrder(returnOrderId, mapEditValuesToReturnOrderPayload(values));
}

export function runReturnOrderArchive(returnOrderId: string) {
  return archiveReturnOrder(returnOrderId);
}

export function runReturnReceiptCreate(values: ReturnReceiptCreateValues) {
  return createReturnReceipt(values);
}

export function runReturnDispositionCreate(values: ReturnDispositionCreateValues) {
  return createReturnDisposition(values);
}
