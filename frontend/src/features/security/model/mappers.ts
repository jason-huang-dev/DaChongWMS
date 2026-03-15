import type { StaffFormValues, StaffRecord } from "@/features/security/model/types";

export const defaultStaffFormValues: StaffFormValues = {
  staff_name: "",
  staff_type: "",
  check_code: 8888,
  is_lock: false,
};

export function mapStaffRecordToFormValues(record: StaffRecord): StaffFormValues {
  return {
    staff_name: record.staff_name,
    staff_type: record.staff_type,
    check_code: record.check_code,
    is_lock: record.is_lock,
  };
}
