import { apiPatch, apiPost } from "@/lib/http";
import type { StaffFormValues, StaffRecord } from "@/features/security/model/types";
import { securityApi } from "@/features/security/model/api";

export function runStaffCreate(values: StaffFormValues) {
  return apiPost<StaffRecord>(securityApi.staff, values);
}

export function runStaffUpdate(staffId: number, values: StaffFormValues) {
  return apiPatch<StaffRecord>(`${securityApi.staff}${staffId}/`, values);
}
