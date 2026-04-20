import { toDateTimeLocalInputValue, toNullableDateTime } from "@/shared/utils/date-time";

import type {
  PurchaseOrderEditValues,
  PurchaseOrderRecord,
  PurchaseOrderUpdatePayload,
  ReceiptCreateValues,
} from "./types";

export const defaultPurchaseOrderEditValues: PurchaseOrderEditValues = {
  expected_arrival_date: "",
  reference_code: "",
  notes: "",
};

export const defaultReceiptCreateValues: ReceiptCreateValues = {
  warehouse: 0,
  purchase_order: 0,
  receipt_location: 0,
  receipt_number: "",
  reference_code: "",
  notes: "",
  line_items: [
    {
      purchase_order_line: 0,
      received_qty: 0,
      stock_status: "AVAILABLE",
      lot_number: "",
      serial_number: "",
      unit_cost: 0,
    },
  ],
};

export function mapPurchaseOrderToEditValues(purchaseOrder: PurchaseOrderRecord): PurchaseOrderEditValues {
  return {
    expected_arrival_date: toDateTimeLocalInputValue(purchaseOrder.expected_arrival_date),
    reference_code: purchaseOrder.reference_code ?? "",
    notes: purchaseOrder.notes ?? "",
  };
}

export function mapEditValuesToPurchaseOrderPayload(
  values: PurchaseOrderEditValues,
): PurchaseOrderUpdatePayload {
  return {
    expected_arrival_date: toNullableDateTime(values.expected_arrival_date),
    reference_code: values.reference_code,
    notes: values.notes,
  };
}
