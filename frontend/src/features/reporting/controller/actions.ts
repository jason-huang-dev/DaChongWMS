import { postInvoiceAction } from "@/features/reporting/model/api";

import type { InvoiceAction, InvoiceActionValues } from "@/features/reporting/model/types";

export function runInvoiceAction(
  invoiceId: string,
  action: InvoiceAction,
  values: InvoiceActionValues,
) {
  return postInvoiceAction(invoiceId, action, values);
}
