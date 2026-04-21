import { z } from "zod";

export const staffFormSchema = z.object({
  staff_name: z.string().trim().min(1, "Staff name is required"),
  staff_type: z.string().trim().min(1, "Role is required"),
  check_code: z.coerce.number().int().min(1000, "Use a 4-digit verification code").max(9999, "Use a 4-digit verification code"),
  is_lock: z.boolean().default(false),
});

export const companyMembershipFormSchema = z.object({
  username: z.string().trim().min(1, "Username is required"),
  email: z.string().trim().email("Valid email is required"),
  password: z
    .string()
    .refine((value) => value.length === 0 || value.length >= 12, "Use at least 12 characters")
    .default(""),
  staff_name: z.string().trim().min(1, "Staff name is required"),
  staff_type: z.string().trim().min(1, "Role is required"),
  check_code: z.coerce.number().int().min(1000, "Use a 4-digit verification code").max(9999, "Use a 4-digit verification code"),
  is_lock: z.boolean().default(false),
  is_active: z.boolean().default(true),
  default_warehouse: z.coerce.number().int().positive().nullable().optional(),
});

export const accessInviteFormSchema = z.object({
  email: z.string().trim().email("Valid email is required"),
  staff_name: z.string().trim().min(1, "Staff name is required"),
  staff_type: z.string().trim().min(1, "Role is required"),
  check_code: z.coerce.number().int().min(1000, "Use a 4-digit verification code").max(9999, "Use a 4-digit verification code"),
  default_warehouse: z.coerce.number().int().positive().nullable().optional(),
  invite_message: z.string().trim().max(500, "Keep the invite note under 500 characters").default(""),
  expires_in_days: z.coerce.number().int().min(1, "Invite must stay active for at least 1 day").max(30, "Invite window is capped at 30 days"),
});

export type StaffFormSchema = z.infer<typeof staffFormSchema>;
export type CompanyMembershipFormSchema = z.infer<typeof companyMembershipFormSchema>;
export type AccessInviteFormSchema = z.infer<typeof accessInviteFormSchema>;
