import { z } from "zod";

export const approvalDecisionSchema = z.object({
  notes: z.string().trim().optional().default(""),
});

export const scannerCompleteSchema = z.object({
  counted_qty: z.coerce.number().min(0, "Counted quantity cannot be negative"),
  adjustment_reason_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});
