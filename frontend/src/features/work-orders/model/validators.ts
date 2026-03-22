import { z } from "zod";

function positiveWholeNumberField(label: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`)
    .refine((value) => Number(value) > 0, `${label} must be greater than zero`);
}

function nonNegativeWholeNumberField(label: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, `${label} must be a whole number`);
}

export const workOrderTypeFormSchema = z.object({
  code: z.string().trim().min(1, "Type code is required").max(64, "Type code must be 64 characters or less"),
  name: z.string().trim().min(1, "Type name is required").max(255, "Type name must be 255 characters or less"),
  description: z.string().trim().max(2000, "Description must be 2000 characters or less").default(""),
  workstream: z.enum(["INBOUND", "OUTBOUND", "INVENTORY", "RETURNS", "GENERAL"]),
  default_urgency: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  default_priority_score: positiveWholeNumberField("Default priority score").refine(
    (value) => Number(value) <= 100,
    "Default priority score must be 100 or less",
  ),
  target_sla_hours: positiveWholeNumberField("Target SLA hours").refine(
    (value) => Number(value) <= 720,
    "Target SLA hours must be 720 or less",
  ),
  is_active: z.boolean().default(true),
});

export const workOrderFormSchema = z.object({
  work_order_type_id: z.string().trim().min(1, "Work order type is required"),
  warehouse_id: z.string().trim().default(""),
  customer_account_id: z.string().trim().default(""),
  title: z.string().trim().min(1, "Work order title is required").max(255, "Work order title is too long"),
  source_reference: z.string().trim().max(100, "Source reference must be 100 characters or less").default(""),
  status: z.enum(["PENDING_REVIEW", "READY", "SCHEDULED", "IN_PROGRESS", "BLOCKED", "COMPLETED", "CANCELLED"]),
  urgency: z.enum(["", "LOW", "MEDIUM", "HIGH", "CRITICAL"]).default(""),
  priority_score: z
    .string()
    .trim()
    .refine(
      (value) => value.length === 0 || (/^\d+$/.test(value) && Number(value) > 0 && Number(value) <= 100),
      "Priority score must be between 1 and 100",
    )
    .default(""),
  assignee_name: z.string().trim().max(255, "Assignee name must be 255 characters or less").default(""),
  scheduled_start_at: z.string().trim().default(""),
  due_at: z.string().trim().default(""),
  estimated_duration_minutes: nonNegativeWholeNumberField("Estimated duration"),
  notes: z.string().trim().max(2000, "Notes must be 2000 characters or less").default(""),
});

export type WorkOrderTypeFormSchema = z.infer<typeof workOrderTypeFormSchema>;
export type WorkOrderFormSchema = z.infer<typeof workOrderFormSchema>;

