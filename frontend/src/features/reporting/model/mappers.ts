import type { InvoiceActionValues } from "./types";

export const defaultInvoiceActionValues: InvoiceActionValues = {
  notes: "",
};

export function sumInvoiceAmounts(
  values: Array<{ amount?: string; disputed_amount?: string; approved_credit_amount?: string }>,
  key: "amount" | "disputed_amount" | "approved_credit_amount",
) {
  const total = values.reduce((running, value) => running + Number(value[key] ?? 0), 0);
  return total.toFixed(4);
}
