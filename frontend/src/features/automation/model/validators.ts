import { z } from "zod";

import { parseJsonObject } from "@/shared/utils/json";

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined || value === 0 ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

export const scheduledTaskCreateSchema = z.object({
  warehouse: optionalPositiveNumber,
  customer: optionalPositiveNumber,
  name: z.string().trim().min(1, "Task name is required"),
  task_type: z.string().trim().min(1, "Task type is required"),
  interval_minutes: z.coerce.number().int().positive("Interval must be greater than zero"),
  next_run_at: z.string().trim().min(1, "Next run time is required"),
  priority: z.coerce.number().int().min(0, "Priority cannot be negative"),
  max_attempts: z.coerce.number().int().positive("Max attempts must be greater than zero"),
  is_active: z.boolean().default(true),
  payload_json: z.string().trim().default("{}"),
  notes: z.string().trim().optional().default(""),
}).superRefine((values, context) => {
  try {
    parseJsonObject(values.payload_json, "Payload");
  } catch (error) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: error instanceof Error ? error.message : "Payload must be valid JSON",
      path: ["payload_json"],
    });
  }
});
