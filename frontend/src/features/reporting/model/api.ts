import { apiPost } from "@/lib/http";

import type { InvoiceAction, InvoiceActionValues, InvoiceRecord } from "./types";

export const reportingApi = {
  financeExports: "/api/reporting/finance-exports/",
  invoiceDisputes: "/api/reporting/invoice-disputes/",
  invoiceSettlements: "/api/reporting/invoice-settlements/",
  invoices: "/api/reporting/invoices/",
  reportExports: "/api/reporting/report-exports/",
};

export function postInvoiceAction(
  invoiceId: string,
  action: InvoiceAction,
  values: InvoiceActionValues,
) {
  return apiPost<InvoiceRecord>(`${reportingApi.invoices}${invoiceId}/${action}/`, values);
}
