import { z } from "zod";

export const transferOrderEditSchema = z.object({
  requested_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const transferOrderCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  transfer_number: z.string().trim().min(1, "Transfer number is required"),
  requested_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  line_items: z
    .array(
      z.object({
        source_balance: z.coerce.number().int().positive("Source SKU/location is required"),
        to_location: z.coerce.number().int().positive("Destination location is required"),
        requested_qty: z.coerce.number().positive("Requested quantity must be greater than zero"),
      }),
    )
    .min(1, "At least one transfer line is required"),
});
