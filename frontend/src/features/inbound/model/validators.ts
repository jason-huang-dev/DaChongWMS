import { z } from "zod";

export const purchaseOrderEditSchema = z.object({
  expected_arrival_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const receiptCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  purchase_order: z.coerce.number().int().positive("Purchase order is required"),
  receipt_location: z.coerce.number().int().positive("Receipt location is required"),
  receipt_number: z.string().trim().min(1, "Receipt number is required"),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  line_items: z
    .array(
      z.object({
        purchase_order_line: z.coerce.number().int().positive("Purchase order line is required"),
        received_qty: z.coerce.number().positive("Received quantity must be greater than zero"),
        stock_status: z.string().trim().min(1, "Stock status is required"),
        lot_number: z.string().trim().optional().default(""),
        serial_number: z.string().trim().optional().default(""),
        unit_cost: z.coerce.number().min(0, "Unit cost cannot be negative"),
      }),
    )
    .min(1, "At least one receipt line is required"),
});

export const scanReceiveSchema = z
  .object({
    purchase_order_number: z.string().trim().optional().default(""),
    asn_number: z.string().trim().optional().default(""),
    receipt_number: z.string().trim().min(1, "Receipt number is required"),
    receipt_location_barcode: z.string().trim().min(1, "Receipt location barcode is required"),
    goods_barcode: z.string().trim().min(1, "Goods barcode is required"),
    lpn_barcode: z.string().trim().optional().default(""),
    attribute_scan: z.string().trim().optional().default(""),
    received_qty: z.coerce.number().positive("Received quantity must be greater than zero"),
    stock_status: z.string().trim().min(1, "Stock status is required"),
    lot_number: z.string().trim().optional().default(""),
    serial_number: z.string().trim().optional().default(""),
    unit_cost: z.coerce.number().min(0, "Unit cost cannot be negative"),
    reference_code: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    order_type: z.string().trim().optional().default(""),
  })
  .superRefine((values, context) => {
    if (!values.purchase_order_number && !values.asn_number) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a purchase order number or an ASN number",
        path: ["purchase_order_number"],
      });
    }
  });

export const scanSignSchema = z
  .object({
    purchase_order_number: z.string().trim().optional().default(""),
    asn_number: z.string().trim().optional().default(""),
    signing_number: z.string().trim().min(1, "Signing number is required"),
    carrier_name: z.string().trim().optional().default(""),
    vehicle_plate: z.string().trim().optional().default(""),
    reference_code: z.string().trim().optional().default(""),
    notes: z.string().trim().optional().default(""),
    order_type: z.string().trim().optional().default(""),
  })
  .superRefine((values, context) => {
    if (!values.purchase_order_number && !values.asn_number) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either a purchase order number or an ASN number",
        path: ["purchase_order_number"],
      });
    }
  });

export const scanPutawaySchema = z.object({
  task_number: z.string().trim().min(1, "Task number is required"),
  from_location_barcode: z.string().trim().min(1, "From-location barcode is required"),
  to_location_barcode: z.string().trim().min(1, "To-location barcode is required"),
  goods_barcode: z.string().trim().min(1, "Goods barcode is required"),
  lpn_barcode: z.string().trim().optional().default(""),
  order_type: z.string().trim().optional().default(""),
});
