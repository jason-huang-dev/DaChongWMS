import { toDateTimeLocalInputValue, toNullableDateTime } from "@/shared/utils/date-time";

import type {
  InventoryBalanceRecord,
  TransferOrderCreatePayload,
  TransferOrderCreateValues,
  TransferOrderEditValues,
  TransferOrderRecord,
  TransferOrderUpdatePayload,
} from "./types";

export const defaultTransferOrderEditValues: TransferOrderEditValues = {
  requested_date: "",
  reference_code: "",
  notes: "",
};

export const defaultTransferOrderCreateValues: TransferOrderCreateValues = {
  warehouse: 0,
  transfer_number: "",
  requested_date: "",
  reference_code: "",
  notes: "",
  line_items: [
    {
      source_balance: 0,
      to_location: 0,
      requested_qty: 0,
    },
  ],
};

export function mapTransferOrderToEditValues(
  transferOrder: TransferOrderRecord,
): TransferOrderEditValues {
  return {
    requested_date: toDateTimeLocalInputValue(transferOrder.requested_date),
    reference_code: transferOrder.reference_code ?? "",
    notes: transferOrder.notes ?? "",
  };
}

export function mapEditValuesToTransferOrderPayload(
  values: TransferOrderEditValues,
): TransferOrderUpdatePayload {
  return {
    requested_date: toNullableDateTime(values.requested_date),
    reference_code: values.reference_code,
    notes: values.notes,
  };
}

export function mapCreateValuesToTransferOrderPayload(
  values: TransferOrderCreateValues,
  balancesById: Map<number, InventoryBalanceRecord>,
): TransferOrderCreatePayload {
  return {
    warehouse: values.warehouse,
    transfer_number: values.transfer_number,
    requested_date: toNullableDateTime(values.requested_date),
    reference_code: values.reference_code,
    notes: values.notes,
    line_items: values.line_items.map((lineItem, index) => {
      const balance = balancesById.get(lineItem.source_balance);
      if (!balance) {
        throw new Error(`Source balance ${lineItem.source_balance} is unavailable`);
      }
      return {
        line_number: index + 1,
        goods: balance.goods,
        from_location: balance.location,
        to_location: lineItem.to_location,
        requested_qty: lineItem.requested_qty,
        stock_status: balance.stock_status,
        lot_number: balance.lot_number,
        serial_number: balance.serial_number,
        notes: "",
      };
    }),
  };
}
