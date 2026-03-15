import type {
  ReturnDispositionRecord,
  ReturnOrderRecord,
  ReturnReceiptRecord,
  SalesOrderRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type {
  returnDispositionCreateSchema,
  returnOrderCreateSchema,
  returnOrderEditSchema,
  returnReceiptCreateSchema,
} from "./validators";

export type { ReturnDispositionRecord, ReturnOrderRecord, ReturnReceiptRecord, SalesOrderRecord };

export type ReturnOrderCreateValues = z.infer<typeof returnOrderCreateSchema>;
export type ReturnOrderEditValues = z.infer<typeof returnOrderEditSchema>;
export type ReturnReceiptCreateValues = z.infer<typeof returnReceiptCreateSchema>;
export type ReturnDispositionCreateValues = z.infer<typeof returnDispositionCreateSchema>;

export interface ReturnOrderCreatePayload {
  warehouse: number;
  customer: number;
  sales_order: number;
  return_number: string;
  requested_date: string | null;
  reference_code: string;
  notes: string;
  line_items: Array<{
    line_number: number;
    goods: number;
    expected_qty: number;
    return_reason: string;
    notes: string;
  }>;
}

export interface ReturnOrderUpdatePayload {
  requested_date: string | null;
  reference_code: string;
  notes: string;
}
