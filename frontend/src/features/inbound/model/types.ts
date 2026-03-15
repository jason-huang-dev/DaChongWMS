import type { PurchaseOrderRecord, PutawayTaskRecord, ReceiptRecord } from "@/shared/types/domain";
import type { z } from "zod";

import type { purchaseOrderEditSchema, receiptCreateSchema, scanPutawaySchema, scanReceiveSchema } from "./validators";

export type { PurchaseOrderRecord, PutawayTaskRecord, ReceiptRecord };
export type PurchaseOrderEditValues = z.infer<typeof purchaseOrderEditSchema>;
export type ReceiptCreateValues = z.infer<typeof receiptCreateSchema>;
export interface PurchaseOrderUpdatePayload {
  expected_arrival_date: string | null;
  reference_code: string;
  notes: string;
}
export type ScanPutawayValues = z.infer<typeof scanPutawaySchema>;
export type ScanReceiveValues = z.infer<typeof scanReceiveSchema>;
