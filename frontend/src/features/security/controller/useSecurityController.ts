import { useMemo, useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runAccessInviteCreate,
  runAccessInviteRevoke,
  runCompanyMembershipCreate,
  runCompanyMembershipUpdate,
  runPasswordResetIssue,
  runPasswordResetRevoke,
  runStaffCreate,
  runStaffUpdate,
} from "@/features/security/controller/actions";
import { securityApi } from "@/features/security/model/api";
import {
  defaultAccessInviteFormValues,
  defaultCompanyMembershipFormValues,
  defaultStaffFormValues,
  mapCompanyMembershipRecordToFormValues,
  mapStaffRecordToFormValues,
} from "@/features/security/model/mappers";
import type {
  AccessAuditEventRecord,
  AccessInviteFormValues,
  CompanyInviteRecord,
  CompanyMembershipFormValues,
  CompanyMembershipRecord,
  CompanyPasswordResetRecord,
  MfaStatusRecord,
  StaffFormValues,
  StaffRecord,
  StaffTypeRecord,
} from "@/features/security/model/types";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function useSecurityController() {
  const queryClient = useQueryClient();
  const { session } = useAuth();
  const { company, activeWarehouse } = useTenantScope();
  const [selectedStaff, setSelectedStaff] = useState<StaffRecord | null>(null);
  const [selectedMembership, setSelectedMembership] = useState<CompanyMembershipRecord | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const staffView = useDataView({
    viewKey: `security.staff.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      staff_name__icontains: "",
      staff_type: "",
    },
    pageSize: 12,
  });

  const staffQuery = usePaginatedResource<StaffRecord>(
    ["security", "staff"],
    securityApi.staff,
    staffView.page,
    staffView.pageSize,
    staffView.queryFilters,
  );

  const membershipView = useDataView({
    viewKey: `security.memberships.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      auth_user__username__icontains: "",
      staff__staff_type: "",
    },
    pageSize: 12,
  });
  const invitesView = useDataView({
    viewKey: `security.invites.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      email__icontains: "",
      status: "",
    },
    pageSize: 10,
  });
  const passwordResetView = useDataView({
    viewKey: `security.password-resets.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      membership__auth_user__username__icontains: "",
      status: "",
    },
    pageSize: 10,
  });
  const auditView = useDataView({
    viewKey: `security.audit.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      target_identifier__icontains: "",
      action_type: "",
    },
    pageSize: 10,
  });

  const membershipsQuery = usePaginatedResource<CompanyMembershipRecord>(
    ["security", "company-memberships"],
    securityApi.companyMemberships,
    membershipView.page,
    membershipView.pageSize,
    membershipView.queryFilters,
  );

  const staffTypesQuery = usePaginatedResource<StaffTypeRecord>(
    ["security", "staff-types"],
    securityApi.staffTypes,
    1,
    100,
  );

  const mfaStatusQuery = useResource<MfaStatusRecord>(
    ["security", "mfa-status", session?.operatorId],
    securityApi.mfaStatus,
    undefined,
    { enabled: Boolean(session) },
  );
  const invitesQuery = usePaginatedResource<CompanyInviteRecord>(
    ["security", "company-invites"],
    securityApi.companyInvites,
    invitesView.page,
    invitesView.pageSize,
    invitesView.queryFilters,
  );
  const passwordResetsQuery = usePaginatedResource<CompanyPasswordResetRecord>(
    ["security", "password-resets"],
    securityApi.passwordResets,
    passwordResetView.page,
    passwordResetView.pageSize,
    passwordResetView.queryFilters,
  );
  const auditEventsQuery = usePaginatedResource<AccessAuditEventRecord>(
    ["security", "audit-events"],
    securityApi.auditEvents,
    auditView.page,
    auditView.pageSize,
    auditView.queryFilters,
  );

  const createMutation = useMutation({
    mutationFn: (values: StaffFormValues) => runStaffCreate(values),
    onSuccess: async (staff) => {
      setErrorMessage(null);
      setSuccessMessage(`Staff record ${staff.staff_name} created.`);
      setSelectedStaff(staff);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const updateMutation = useMutation({
    mutationFn: (values: StaffFormValues) => {
      if (!selectedStaff) {
        throw new Error("No staff member selected");
      }
      return runStaffUpdate(selectedStaff.id, values);
    },
    onSuccess: async (staff) => {
      setErrorMessage(null);
      setSuccessMessage(`Staff record ${staff.staff_name} updated.`);
      setSelectedStaff(staff);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const createMembershipMutation = useMutation({
    mutationFn: (values: CompanyMembershipFormValues) => runCompanyMembershipCreate(values),
    onSuccess: async (membership) => {
      setErrorMessage(null);
      setSuccessMessage(`Browser account ${membership.username} provisioned for ${membership.company_name}.`);
      setSelectedMembership(membership);
      await invalidateQueryGroups(queryClient, [["security"], ["scope"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const updateMembershipMutation = useMutation({
    mutationFn: (values: CompanyMembershipFormValues) => {
      if (!selectedMembership) {
        throw new Error("No company membership selected");
      }
      return runCompanyMembershipUpdate(selectedMembership.id, values);
    },
    onSuccess: async (membership) => {
      setErrorMessage(null);
      setSuccessMessage(`Browser account ${membership.username} updated.`);
      setSelectedMembership(membership);
      await invalidateQueryGroups(queryClient, [["security"], ["scope"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });
  const createInviteMutation = useMutation({
    mutationFn: (values: AccessInviteFormValues) => runAccessInviteCreate(values),
    onSuccess: async (invite) => {
      setErrorMessage(null);
      setSuccessMessage(`Invite issued for ${invite.email}. Share token ${invite.invite_token}.`);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });
  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId: number) => runAccessInviteRevoke(inviteId),
    onSuccess: async (invite) => {
      setErrorMessage(null);
      setSuccessMessage(`Invite for ${invite.email} revoked.`);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });
  const issuePasswordResetMutation = useMutation({
    mutationFn: (membershipId: number) => runPasswordResetIssue(membershipId),
    onSuccess: async (reset) => {
      setErrorMessage(null);
      setSuccessMessage(`Password reset issued for ${reset.username}. Share token ${reset.reset_token}.`);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });
  const revokePasswordResetMutation = useMutation({
    mutationFn: (resetId: number) => runPasswordResetRevoke(resetId),
    onSuccess: async (reset) => {
      setErrorMessage(null);
      setSuccessMessage(`Password reset for ${reset.username} revoked.`);
      await invalidateQueryGroups(queryClient, [["security"], ["auth"]]);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const roleOptions = useMemo(
    () =>
      (staffTypesQuery.data?.results ?? []).map((role) => ({
        label: role.staff_type,
        value: role.staff_type,
      })),
    [staffTypesQuery.data?.results],
  );

  return {
    company,
    activeWarehouse,
    selectedMembership,
    setSelectedMembership,
    selectedStaff,
    setSelectedStaff,
    membershipDefaultValues: selectedMembership
      ? mapCompanyMembershipRecordToFormValues(selectedMembership)
      : defaultCompanyMembershipFormValues,
    membershipView,
    membershipsQuery,
    isEditingMembership: Boolean(selectedMembership),
    createMembershipMutation,
    updateMembershipMutation,
    createInviteMutation,
    revokeInviteMutation,
    issuePasswordResetMutation,
    revokePasswordResetMutation,
    inviteDefaultValues: defaultAccessInviteFormValues,
    invitesView,
    invitesQuery,
    passwordResetView,
    passwordResetsQuery,
    auditView,
    auditEventsQuery,
    defaultValues: selectedStaff ? mapStaffRecordToFormValues(selectedStaff) : defaultStaffFormValues,
    isEditing: Boolean(selectedStaff),
    createMutation,
    updateMutation,
    staffQuery,
    staffTypesQuery,
    roleOptions,
    mfaStatusQuery,
    staffView,
    successMessage,
    errorMessage,
    clearSelection: () => setSelectedStaff(null),
    clearMembershipSelection: () => setSelectedMembership(null),
  };
}
