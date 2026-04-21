import { z } from "zod";

const codeSchema = z
  .string()
  .trim()
  .min(1, "Code is required")
  .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/, "Use letters, numbers, dashes, or underscores");

const countSchema = z.coerce.number().int().min(1);

export const workspaceSetupSchema = z.object({
  warehouse_name: z.string().trim().min(1, "Warehouse name is required"),
  warehouse_code: codeSchema.max(50, "Warehouse code is too long"),
  storage_area_name: z.string().trim().min(1, "Storage area name is required"),
  storage_area_code: codeSchema.max(64, "Storage area code is too long"),
  location_type_name: z.string().trim().min(1, "Location type name is required"),
  location_type_code: codeSchema.max(64, "Location type code is too long"),
  shelf_prefix: codeSchema.max(12, "Shelf prefix is too long"),
  aisle_count: countSchema.max(20, "Use 20 aisles or fewer for the first setup"),
  bay_count: countSchema.max(50, "Use 50 bays or fewer for the first setup"),
  level_count: countSchema.max(10, "Use 10 levels or fewer for the first setup"),
  slot_count: countSchema.max(20, "Use 20 slots or fewer for the first setup"),
});
