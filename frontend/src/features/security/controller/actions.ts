import { apiPatch, apiPost } from "@/lib/http";
import type {
  AccessInviteFormValues,
  CompanyInviteRecord,
  CompanyMembershipFormValues,
  CompanyMembershipRecord,
  CompanyPasswordResetRecord,
  StaffFormValues,
  StaffRecord,
} from "@/features/security/model/types";
import { securityApi } from "@/features/security/model/api";

export function runStaffCreate(values: StaffFormValues) {
  return apiPost<StaffRecord>(securityApi.staff, values);
}

export function runStaffUpdate(staffId: number, values: StaffFormValues) {
  return apiPatch<StaffRecord>(`${securityApi.staff}${staffId}/`, values);
}

export function runCompanyMembershipCreate(values: CompanyMembershipFormValues) {
  return apiPost<CompanyMembershipRecord>(securityApi.companyMemberships, values);
}

export function runCompanyMembershipUpdate(membershipId: number, values: CompanyMembershipFormValues) {
  return apiPatch<CompanyMembershipRecord>(`${securityApi.companyMemberships}${membershipId}/`, values);
}

export function runAccessInviteCreate(values: AccessInviteFormValues) {
  return apiPost<CompanyInviteRecord>(securityApi.companyInvites, values);
}

export function runAccessInviteRevoke(inviteId: number) {
  return apiPost<CompanyInviteRecord>(`${securityApi.companyInvites}${inviteId}/revoke/`, {});
}

export function runPasswordResetIssue(membershipId: number) {
  return apiPost<CompanyPasswordResetRecord>(securityApi.passwordResets, {
    membership: membershipId,
    expires_in_hours: 24,
    notes: "",
  });
}

export function runPasswordResetRevoke(resetId: number) {
  return apiPost<CompanyPasswordResetRecord>(`${securityApi.passwordResets}${resetId}/revoke/`, {});
}
