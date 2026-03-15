import type {
  FinanceExportRecord,
  InvoiceDisputeRecord,
  InvoiceRecord,
  InvoiceSettlementRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { invoiceActionSchema } from "./validators";

export type {
  FinanceExportRecord,
  InvoiceDisputeRecord,
  InvoiceRecord,
  InvoiceSettlementRecord,
};

export type InvoiceAction =
  | "finalize"
  | "submit-finance-review"
  | "approve-finance-review"
  | "reject-finance-review";

export type InvoiceActionValues = z.infer<typeof invoiceActionSchema>;
