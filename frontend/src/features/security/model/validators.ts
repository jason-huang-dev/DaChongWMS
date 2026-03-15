import { z } from "zod";

export const staffFormSchema = z.object({
  staff_name: z.string().trim().min(1, "Staff name is required"),
  staff_type: z.string().trim().min(1, "Role is required"),
  check_code: z.coerce.number().int().min(1000, "Use a 4-digit verification code").max(9999, "Use a 4-digit verification code"),
  is_lock: z.boolean().default(false),
});

export type StaffFormSchema = z.infer<typeof staffFormSchema>;
