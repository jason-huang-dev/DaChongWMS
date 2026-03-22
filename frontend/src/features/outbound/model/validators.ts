import { z } from "zod";

const optionalPositiveId = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

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

export const waveCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  wave_number: z.string().trim().min(1, "Wave number is required"),
  sales_order_ids: z.string().trim().min(1, "At least one sales order id is required"),
  notes: z.string().trim().optional().default(""),
});

export const packageExecutionSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  sales_order: z.coerce.number().int().positive("Sales order is required"),
  shipment: optionalPositiveId,
  wave: optionalPositiveId,
  record_number: z.string().trim().min(1, "Record number is required"),
  step_type: z.enum(["RELABEL", "PACK", "INSPECT", "WEIGH"]),
  execution_status: z.enum(["SUCCESS", "FLAGGED"]).default("SUCCESS"),
  package_number: z.string().trim().min(1, "Package number is required"),
  scan_code: z.string().trim().optional().default(""),
  weight: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().nonnegative("Weight must be zero or greater").optional(),
  ),
  notes: z.string().trim().optional().default(""),
  requested_order_type: z.string().trim().optional().default(""),
});

export const shipmentDocumentSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  sales_order: z.coerce.number().int().positive("Sales order is required"),
  shipment: optionalPositiveId,
  wave: optionalPositiveId,
  document_number: z.string().trim().min(1, "Document number is required"),
  document_type: z.enum(["MANIFEST", "PHOTO", "SCANFORM"]),
  reference_code: z.string().trim().optional().default(""),
  file_name: z.string().trim().optional().default(""),
  notes: z.string().trim().optional().default(""),
});

export const logisticsTrackingSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  sales_order: z.coerce.number().int().positive("Sales order is required"),
  shipment: optionalPositiveId,
  event_number: z.string().trim().min(1, "Event number is required"),
  tracking_number: z.string().trim().optional().default(""),
  event_code: z.string().trim().min(1, "Event code is required"),
  event_status: z.enum(["INFO_RECEIVED", "IN_TRANSIT", "ARRIVED", "OUT_FOR_DELIVERY", "DELIVERED", "EXCEPTION"]),
  event_location: z.string().trim().optional().default(""),
  description: z.string().trim().optional().default(""),
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
