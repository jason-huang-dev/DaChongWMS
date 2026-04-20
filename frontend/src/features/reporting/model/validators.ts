import { z } from "zod";

export const invoiceActionSchema = z.object({
  notes: z.string().trim().optional().default(""),
});
