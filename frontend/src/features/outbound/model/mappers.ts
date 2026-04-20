import { toDateTimeLocalInputValue, toNullableDateTime } from "@/shared/utils/date-time";

import type {
  SalesOrderEditValues,
  SalesOrderRecord,
  SalesOrderUpdatePayload,
  ShipmentCreateValues,
} from "./types";

export const defaultSalesOrderEditValues: SalesOrderEditValues = {
  requested_ship_date: "",
  reference_code: "",
  notes: "",
};

export const defaultShipmentCreateValues: ShipmentCreateValues = {
  warehouse: 0,
  sales_order: 0,
  staging_location: 0,
  shipment_number: "",
  reference_code: "",
  notes: "",
  line_items: [
    {
      sales_order_line: 0,
      shipped_qty: 0,
      stock_status: "AVAILABLE",
      lot_number: "",
      serial_number: "",
    },
  ],
};

export function mapSalesOrderToEditValues(salesOrder: SalesOrderRecord): SalesOrderEditValues {
  return {
    requested_ship_date: toDateTimeLocalInputValue(salesOrder.requested_ship_date),
    reference_code: salesOrder.reference_code ?? "",
    notes: salesOrder.notes ?? "",
  };
}

export function mapEditValuesToSalesOrderPayload(
  values: SalesOrderEditValues,
): SalesOrderUpdatePayload {
  return {
    requested_ship_date: toNullableDateTime(values.requested_ship_date),
    reference_code: values.reference_code,
    notes: values.notes,
  };
}
