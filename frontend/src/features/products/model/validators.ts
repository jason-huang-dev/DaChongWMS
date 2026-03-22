import { z } from "zod";

function decimalTextField(label: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `${label} must be a positive number with up to 2 decimals`);
}

export const productFormSchema = z.object({
  sku: z.string().trim().min(1, "SKU is required"),
  name: z.string().trim().min(1, "Product name is required"),
  barcode: z.string().trim().max(128, "Barcode must be 128 characters or less").default(""),
  unit_of_measure: z.string().trim().min(1, "Unit of measure is required").max(32, "Unit of measure is too long"),
  category: z.string().trim().max(100, "Category must be 100 characters or less").default(""),
  brand: z.string().trim().max(100, "Brand must be 100 characters or less").default(""),
  description: z.string().trim().max(2000, "Description must be 2000 characters or less").default(""),
  is_active: z.boolean().default(true),
});

export const distributionProductFormSchema = z.object({
  customer_account_id: z.string().trim().min(1, "Client account is required"),
  external_sku: z.string().trim().min(1, "Distribution SKU is required"),
  external_name: z.string().trim().max(255, "Distribution name must be 255 characters or less").default(""),
  channel_name: z.string().trim().max(100, "Channel must be 100 characters or less").default(""),
  allow_dropshipping_orders: z.boolean().default(true),
  allow_inbound_goods: z.boolean().default(true),
  is_active: z.boolean().default(true),
});

export const productSerialManagementFormSchema = z.object({
  tracking_mode: z.enum(["NONE", "OPTIONAL", "REQUIRED"]),
  serial_pattern: z.string().trim().max(255, "Serial pattern must be 255 characters or less").default(""),
  requires_uniqueness: z.boolean().default(true),
  capture_on_inbound: z.boolean().default(false),
  capture_on_outbound: z.boolean().default(false),
  capture_on_returns: z.boolean().default(false),
});

export const productPackagingFormSchema = z.object({
  package_type: z.enum(["UNIT", "INNER", "CARTON", "PALLET", "CUSTOM"]),
  package_code: z.string().trim().min(1, "Package code is required").max(50, "Package code is too long"),
  units_per_package: z
    .string()
    .trim()
    .regex(/^\d+$/, "Units per package must be a whole number")
    .refine((value) => Number(value) > 0, "Units per package must be greater than zero"),
  length_cm: decimalTextField("Length"),
  width_cm: decimalTextField("Width"),
  height_cm: decimalTextField("Height"),
  weight_kg: decimalTextField("Weight"),
  is_default: z.boolean().default(false),
  is_active: z.boolean().default(true),
});

export const productMarkFormSchema = z.object({
  mark_type: z.enum(["FRAGILE", "BATTERY", "TEMPERATURE", "LABEL", "CUSTOM"]),
  value: z.string().trim().min(1, "Mark value is required").max(255, "Mark value must be 255 characters or less"),
  notes: z.string().trim().max(1000, "Notes must be 1000 characters or less").default(""),
  is_active: z.boolean().default(true),
});

export type ProductFormSchema = z.infer<typeof productFormSchema>;
export type DistributionProductFormSchema = z.infer<typeof distributionProductFormSchema>;
export type ProductSerialManagementFormSchema = z.infer<typeof productSerialManagementFormSchema>;
export type ProductPackagingFormSchema = z.infer<typeof productPackagingFormSchema>;
export type ProductMarkFormSchema = z.infer<typeof productMarkFormSchema>;
