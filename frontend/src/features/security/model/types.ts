import type { StaffRecord } from "@/shared/types/domain";

export type { StaffRecord };

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
