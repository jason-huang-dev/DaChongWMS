import { z } from "zod";

export const inventoryAdjustmentSchema = z.object({
  balance_id: z.coerce.number().int().positive("Inventory position is required"),
  movement_type: z.enum(["ADJUSTMENT_IN", "ADJUSTMENT_OUT"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  reason: z.string().trim().min(1, "Reason is required").max(255, "Reason must be 255 characters or less"),
  reference_code: z.string().trim().max(64, "Reference code must be 64 characters or less").default(""),
});
