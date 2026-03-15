import { toDateTimeLocalInputValue, toNullableDateTime } from "@/shared/utils/date-time";

import type {
  ReturnDispositionCreateValues,
  ReturnOrderCreatePayload,
  ReturnOrderCreateValues,
  ReturnOrderEditValues,
  ReturnOrderRecord,
  ReturnOrderUpdatePayload,
  ReturnReceiptCreateValues,
  SalesOrderRecord,
} from "./types";

export const defaultReturnOrderEditValues: ReturnOrderEditValues = {
  requested_date: "",
  reference_code: "",
  notes: "",
};

export const defaultReturnOrderCreateValues: ReturnOrderCreateValues = {
  warehouse: 0,
  sales_order: 0,
  return_number: "",
  requested_date: "",
  reference_code: "",
  notes: "",
  line_items: [
    {
      sales_order_line: 0,
      expected_qty: 0,
      return_reason: "",
      notes: "",
    },
  ],
};

export const defaultReturnReceiptValues: ReturnReceiptCreateValues = {
  return_line: 0,
  warehouse: 0,
  receipt_location: 0,
  receipt_number: "",
  received_qty: 0,
  stock_status: "AVAILABLE",
  lot_number: "",
  serial_number: "",
  notes: "",
};

export const defaultReturnDispositionValues: ReturnDispositionCreateValues = {
  return_receipt: 0,
  warehouse: 0,
  disposition_number: "",
  disposition_type: "RESTOCK",
  quantity: 0,
  to_location: undefined,
  notes: "",
};

export function mapReturnOrderToEditValues(
  returnOrder: ReturnOrderRecord,
): ReturnOrderEditValues {
  return {
    requested_date: toDateTimeLocalInputValue(returnOrder.requested_date),
    reference_code: returnOrder.reference_code ?? "",
    notes: returnOrder.notes ?? "",
  };
}

export function mapEditValuesToReturnOrderPayload(
  values: ReturnOrderEditValues,
): ReturnOrderUpdatePayload {
  return {
    requested_date: toNullableDateTime(values.requested_date),
    reference_code: values.reference_code,
    notes: values.notes,
  };
}

export function mapCreateValuesToReturnOrderPayload(
  values: ReturnOrderCreateValues,
  salesOrder: SalesOrderRecord,
): ReturnOrderCreatePayload {
  return {
    warehouse: values.warehouse,
    customer: salesOrder.customer,
    sales_order: values.sales_order,
    return_number: values.return_number,
    requested_date: toNullableDateTime(values.requested_date),
    reference_code: values.reference_code,
    notes: values.notes,
    line_items: values.line_items.map((lineItem, index) => {
      const salesOrderLine = salesOrder.lines.find((line) => line.id === lineItem.sales_order_line);
      if (!salesOrderLine) {
        throw new Error(`Sales order line ${lineItem.sales_order_line} is unavailable`);
      }
      return {
        line_number: index + 1,
        goods: salesOrderLine.goods,
        expected_qty: lineItem.expected_qty,
        return_reason: lineItem.return_reason,
        notes: lineItem.notes,
      };
    }),
  };
}
