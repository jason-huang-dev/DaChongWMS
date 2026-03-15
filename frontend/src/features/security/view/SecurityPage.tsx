import Grid from "@mui/material/Grid";
import { Alert, Button, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { useSecurityController } from "@/features/security/controller/useSecurityController";
import { SecurityForm } from "@/features/security/view/SecurityForm";
import { SecurityTable } from "@/features/security/view/SecurityTable";
import { PageHeader } from "@/shared/components/page-header";
import { SummaryCard } from "@/shared/components/summary-card";
import { hasAnyRole } from "@/shared/utils/permissions";

export function SecurityPage() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const {
    company,
    activeWarehouse,
    selectedStaff,
    setSelectedStaff,
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
  } = useSecurityController();
  const canManageAccess = hasAnyRole(session, ["Manager", "Supervisor"]);

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
              { label: "Saved views", value: String(staffView.savedViews.length) },
              { label: "Selected operator", value: selectedStaff?.staff_name ?? "None" },
            ]}
            title="Access overview"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Known platform gap to track with the backend roadmap."
            items={[
              { label: "Admin-created browser accounts", value: "Pending backend API" },
              { label: "Role-based page guards", value: "Implemented" },
              { label: "Warehouse context", value: activeWarehouse ? "Implemented" : "Needs warehouse data" },
            ]}
            title="Roadmap status"
          />
        </Grid>
        {canManageAccess ? (
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
      </Grid>
    </Stack>
  );
}
