import { z } from "zod";

export const salesOrderEditSchema = z.object({
  requested_ship_date: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const shipmentCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  sales_order: z.coerce.number().int().positive("Sales order is required"),
  staging_location: z.coerce.number().int().positive("Staging location is required"),
  shipment_number: z.string().trim().min(1, "Shipment number is required"),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  line_items: z
    .array(
      z.object({
        sales_order_line: z.coerce.number().int().positive("Sales order line is required"),
        shipped_qty: z.coerce.number().positive("Shipped quantity must be greater than zero"),
        stock_status: z.string().trim().min(1, "Stock status is required"),
        lot_number: z.string().trim().optional().default(""),
        serial_number: z.string().trim().optional().default(""),
        from_location: z.coerce.number().int().positive().optional(),
      }),
    )
    .min(1, "At least one shipment line is required"),
});

export const scanPickSchema = z.object({
  task_number: z.string().trim().min(1, "Task number is required"),
  from_location_barcode: z.string().trim().min(1, "From-location barcode is required"),
  goods_barcode: z.string().trim().min(1, "Goods barcode is required"),
  to_location_barcode: z.string().trim().min(1, "To-location barcode is required"),
  lpn_barcode: z.string().trim().optional().default(""),
});

export const scanShipSchema = z.object({
  sales_order_number: z.string().trim().min(1, "Sales order number is required"),
  shipment_number: z.string().trim().min(1, "Shipment number is required"),
  staging_location_barcode: z.string().trim().min(1, "Staging location barcode is required"),
  goods_barcode: z.string().trim().min(1, "Goods barcode is required"),
  dock_location_barcode: z.string().trim().optional().default(""),
  lpn_barcode: z.string().trim().optional().default(""),
  attribute_scan: z.string().trim().optional().default(""),
  shipped_qty: z.coerce.number().positive("Shipped quantity must be greater than zero"),
  stock_status: z.string().trim().min(1, "Stock status is required"),
  lot_number: z.string().trim().optional().default(""),
  serial_number: z.string().trim().optional().default(""),
  reference_code: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
  trailer_reference: z.string().trim().optional().default(""),
});
