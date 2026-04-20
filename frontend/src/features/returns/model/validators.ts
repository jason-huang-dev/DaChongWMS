import { z } from "zod";

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const returnOrderEditSchema = z.object({
  requested_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const returnOrderCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  sales_order: z.coerce.number().int().positive("Sales order is required"),
  return_number: z.string().trim().min(1, "Return number is required"),
  requested_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  line_items: z
    .array(
      z.object({
        sales_order_line: z.coerce.number().int().positive("Sales order line is required"),
        expected_qty: z.coerce.number().positive("Expected quantity must be greater than zero"),
        return_reason: z.string().trim().optional().default(""),
        notes: z.string().trim().optional().default(""),
      }),
    )
    .min(1, "At least one return line is required"),
});

export const returnReceiptCreateSchema = z.object({
  return_line: z.coerce.number().int().positive("Return line id is required"),
  warehouse: z.coerce.number().int().positive("Warehouse id is required"),
  receipt_location: z.coerce.number().int().positive("Receipt location id is required"),
  receipt_number: z.string().trim().min(1, "Receipt number is required"),
  received_qty: z.coerce.number().positive("Received quantity must be greater than zero"),
  stock_status: z.string().trim().min(1, "Stock status is required"),
  lot_number: z.string().trim().optional().default(""),
  serial_number: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const returnDispositionCreateSchema = z.object({
  return_receipt: z.coerce.number().int().positive("Return receipt id is required"),
  warehouse: z.coerce.number().int().positive("Warehouse id is required"),
  disposition_number: z.string().trim().min(1, "Disposition number is required"),
  disposition_type: z.string().trim().min(1, "Disposition type is required"),
  quantity: z.coerce.number().positive("Disposition quantity must be greater than zero"),
  to_location: optionalPositiveNumber,
  notes: z.string().trim().optional().default(""),
});
