import Grid from "@mui/material/Grid";
import { Alert, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { useSecurityController } from "@/features/security/controller/useSecurityController";
import { AccessAuditTable } from "@/features/security/view/AccessAuditTable";
import { AccessInviteForm } from "@/features/security/view/AccessInviteForm";
import { AccessInviteTable } from "@/features/security/view/AccessInviteTable";
import { AccessPasswordResetTable } from "@/features/security/view/AccessPasswordResetTable";
import { CompanyMembershipForm } from "@/features/security/view/CompanyMembershipForm";
import { CompanyMembershipTable } from "@/features/security/view/CompanyMembershipTable";
import { SecurityForm } from "@/features/security/view/SecurityForm";
import { SecurityTable } from "@/features/security/view/SecurityTable";
import { PageHeader } from "@/shared/components/page-header";
import { SummaryCard } from "@/shared/components/summary-card";
import { useWarehouseReferenceOptions } from "@/shared/hooks/use-reference-options";
import { hasAnyRole } from "@/shared/utils/permissions";

export function SecurityPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    company,
    activeWarehouse,
    selectedMembership,
    setSelectedMembership,
    selectedStaff,
    setSelectedStaff,
    membershipDefaultValues,
    inviteDefaultValues,
    membershipView,
    invitesView,
    passwordResetView,
    auditView,
    membershipsQuery,
    invitesQuery,
    passwordResetsQuery,
    auditEventsQuery,
    isEditingMembership,
    createMembershipMutation,
    updateMembershipMutation,
    createInviteMutation,
    revokeInviteMutation,
    issuePasswordResetMutation,
    revokePasswordResetMutation,
    defaultValues,
    isEditing,
    createMutation,
    updateMutation,
    staffQuery,
    roleOptions,
    mfaStatusQuery,
    staffView,
    successMessage,
    errorMessage,
    clearSelection,
    clearMembershipSelection,
  } = useSecurityController();
  const canManageAccess = hasAnyRole(session, ["Manager", "Supervisor"]);
  const warehouseReference = useWarehouseReferenceOptions();

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button onClick={() => navigate("/mfa/enroll")} variant="contained">
            Manage my MFA
          </Button>
        }
        description="Security operations include staff access, role assignment, verification-code lock control, and personal MFA enrollment."
        title="Security and access"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current tenant scope that the security controls apply to."
            items={[
              { label: "Workspace", value: company?.label ?? "Current tenant" },
              { label: "Warehouse", value: activeWarehouse?.warehouse_name ?? "All warehouses" },
              { label: "Role", value: session?.operatorRole ?? "--" },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current operator MFA posture."
            items={[
              { label: "Verified MFA", value: mfaStatusQuery.data?.has_verified_enrollment ? "Enabled" : "Not enabled" },
              { label: "Recovery codes", value: String(mfaStatusQuery.data?.recovery_codes_remaining ?? 0) },
              { label: "Primary method", value: mfaStatusQuery.data?.primary_enrollment?.method ?? "--" },
            ]}
            title="My MFA"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Warehouse access directory coverage."
            items={[
              { label: "Directory records", value: String(staffQuery.data?.count ?? 0) },
              { label: "Browser accounts", value: String(membershipsQuery.data?.count ?? 0) },
              { label: "Saved views", value: String(staffView.savedViews.length) },
              { label: "Selected user", value: selectedMembership?.username ?? selectedStaff?.staff_name ?? "None" },
            ]}
            title="Access overview"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Company-scoped browser access and workspace switching are now backed by dedicated APIs."
            items={[
              { label: "Company memberships", value: "Implemented" },
              { label: "Admin-created browser accounts", value: "Implemented" },
              { label: "Role-based page guards", value: "Implemented" },
              { label: "Warehouse context", value: activeWarehouse ? "Implemented" : "Needs warehouse data" },
            ]}
            title="Roadmap status"
          />
        </Grid>
        {canManageAccess ? (
          <>
            <Grid size={{ xs: 12, xl: 4 }}>
              <CompanyMembershipForm
                defaultValues={membershipDefaultValues}
                errorMessage={errorMessage}
                isEditing={isEditingMembership}
                isSubmitting={createMembershipMutation.isPending || updateMembershipMutation.isPending}
                onCancelEdit={clearMembershipSelection}
                onSubmit={(values) =>
                  isEditingMembership ? updateMembershipMutation.mutateAsync(values) : createMembershipMutation.mutateAsync(values)
                }
                roleOptions={roleOptions}
                successMessage={successMessage}
                warehouseReference={warehouseReference}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
              <AccessInviteForm
                defaultValues={inviteDefaultValues}
                errorMessage={errorMessage}
                isSubmitting={createInviteMutation.isPending}
                onSubmit={(values) => createInviteMutation.mutateAsync(values)}
                roleOptions={roleOptions}
                successMessage={successMessage}
                warehouseReference={warehouseReference}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 4 }}>
              <SecurityForm
                defaultValues={defaultValues}
                errorMessage={errorMessage}
                isEditing={isEditing}
                isSubmitting={createMutation.isPending || updateMutation.isPending}
                onCancelEdit={clearSelection}
                onSubmit={(values) => (isEditing ? updateMutation.mutateAsync(values) : createMutation.mutateAsync(values))}
                roleOptions={roleOptions}
                successMessage={successMessage}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CompanyMembershipTable
                activeFilterCount={membershipView.activeFilterCount}
                applySavedView={membershipView.applySavedView}
                contextLabel={company ? `Workspace: ${company.label}` : "Tenant-wide memberships"}
                deleteSavedView={membershipView.deleteSavedView}
                filters={membershipView.filters}
                isIssuingPasswordReset={issuePasswordResetMutation.isPending}
                membershipsQuery={membershipsQuery}
                onEdit={(record) => setSelectedMembership(record)}
                onIssuePasswordReset={(record) => issuePasswordResetMutation.mutate(record.id)}
                page={membershipView.page}
                pageSize={membershipView.pageSize}
                resetFilters={membershipView.resetFilters}
                roleOptions={roleOptions}
                saveCurrentView={membershipView.saveCurrentView}
                savedViews={membershipView.savedViews}
                selectedSavedViewId={membershipView.selectedSavedViewId}
                setPage={membershipView.setPage}
                updateFilter={(key, value) => membershipView.updateFilter(key as keyof typeof membershipView.filters & string, value)}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <AccessInviteTable
                activeFilterCount={invitesView.activeFilterCount}
                applySavedView={invitesView.applySavedView}
                contextLabel={company ? `Workspace: ${company.label}` : "Tenant-wide invites"}
                deleteSavedView={invitesView.deleteSavedView}
                filters={invitesView.filters}
                invitesQuery={invitesQuery}
                isRevoking={revokeInviteMutation.isPending}
                onRevoke={(record) => revokeInviteMutation.mutate(record.id)}
                page={invitesView.page}
                pageSize={invitesView.pageSize}
                resetFilters={invitesView.resetFilters}
                saveCurrentView={invitesView.saveCurrentView}
                savedViews={invitesView.savedViews}
                selectedSavedViewId={invitesView.selectedSavedViewId}
                setPage={invitesView.setPage}
                updateFilter={(key, value) => invitesView.updateFilter(key as keyof typeof invitesView.filters & string, value)}
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <AccessPasswordResetTable
                activeFilterCount={passwordResetView.activeFilterCount}
                applySavedView={passwordResetView.applySavedView}
                contextLabel={company ? `Workspace: ${company.label}` : "Tenant-wide resets"}
                deleteSavedView={passwordResetView.deleteSavedView}
                filters={passwordResetView.filters}
                isRevoking={revokePasswordResetMutation.isPending}
                onRevoke={(record) => revokePasswordResetMutation.mutate(record.id)}
                page={passwordResetView.page}
                pageSize={passwordResetView.pageSize}
                resetFilters={passwordResetView.resetFilters}
                resetsQuery={passwordResetsQuery}
                saveCurrentView={passwordResetView.saveCurrentView}
                savedViews={passwordResetView.savedViews}
                selectedSavedViewId={passwordResetView.selectedSavedViewId}
                setPage={passwordResetView.setPage}
                updateFilter={(key, value) =>
                  passwordResetView.updateFilter(key as keyof typeof passwordResetView.filters & string, value)
                }
              />
            </Grid>
          </>
        ) : (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              This page exposes access management only to managers and supervisors. Your current account can still manage its own MFA.
            </Alert>
          </Grid>
        )}
        <Grid size={{ xs: 12, xl: canManageAccess ? 8 : 12 }}>
          <SecurityTable
            activeFilterCount={staffView.activeFilterCount}
            applySavedView={staffView.applySavedView}
            contextLabel={activeWarehouse ? `Warehouse context: ${activeWarehouse.warehouse_name}` : "Tenant-wide directory"}
            deleteSavedView={staffView.deleteSavedView}
            filters={staffView.filters}
            onEdit={(record) => setSelectedStaff(record)}
            page={staffView.page}
            pageSize={staffView.pageSize}
            resetFilters={staffView.resetFilters}
            roleOptions={roleOptions}
            saveCurrentView={staffView.saveCurrentView}
            savedViews={staffView.savedViews}
            selectedSavedViewId={staffView.selectedSavedViewId}
            setPage={staffView.setPage}
            staffQuery={staffQuery}
            updateFilter={(key, value) => staffView.updateFilter(key as keyof typeof staffView.filters & string, value)}
          />
        </Grid>
        {canManageAccess ? (
          <Grid size={{ xs: 12 }}>
            <AccessAuditTable
              activeFilterCount={auditView.activeFilterCount}
              applySavedView={auditView.applySavedView}
              auditQuery={auditEventsQuery}
              contextLabel={company ? `Workspace: ${company.label}` : "Tenant-wide audit"}
              deleteSavedView={auditView.deleteSavedView}
              filters={auditView.filters}
              page={auditView.page}
              pageSize={auditView.pageSize}
              resetFilters={auditView.resetFilters}
              saveCurrentView={auditView.saveCurrentView}
              savedViews={auditView.savedViews}
              selectedSavedViewId={auditView.selectedSavedViewId}
              setPage={auditView.setPage}
              updateFilter={(key, value) => auditView.updateFilter(key as keyof typeof auditView.filters & string, value)}
            />
          </Grid>
        ) : null}
      </Grid>
    </Stack>
  );
}
