import type {
  AccessAuditEventRecord,
  CompanyInviteRecord,
  CompanyMembershipRecord,
  CompanyPasswordResetRecord,
  StaffRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { accessInviteFormSchema, companyMembershipFormSchema, staffFormSchema } from "./validators";

export type { StaffRecord };
export type { CompanyMembershipRecord };
export type { CompanyInviteRecord, CompanyPasswordResetRecord, AccessAuditEventRecord };

export interface StaffTypeRecord {
  id: number;
  staff_type: string;
  creator: string;
  create_time: string;
  update_time: string;
}

export interface MfaStatusRecord {
  has_verified_enrollment: boolean;
  enrollment_required: boolean;
  primary_enrollment: {
    id: number;
    label: string;
    method: string;
    is_verified: boolean;
    is_primary: boolean;
    verified_at: string | null;
    create_time: string;
  } | null;
  recovery_codes_remaining: number;
  verified_methods: string[];
}

export interface StaffFormValues {
  staff_name: string;
  staff_type: string;
  check_code: number;
  is_lock: boolean;
}

export type CompanyMembershipFormValues = z.infer<typeof companyMembershipFormSchema>;
export type AccessInviteFormValues = z.infer<typeof accessInviteFormSchema>;
export type StaffFormValuesSchema = z.infer<typeof staffFormSchema>;
