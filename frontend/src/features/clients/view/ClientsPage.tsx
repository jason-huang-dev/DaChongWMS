import { useEffect, useState } from "react";

import { Alert, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useClientsController } from "@/features/clients/controller/useClientsController";
import {
  buildClientLifecyclePath,
} from "@/features/clients/model/client-accounts";
import type { ClientLifecycleStatus } from "@/features/clients/model/types";
import { ClientAccountForm } from "@/features/clients/view/ClientAccountForm";
import { ClientAccountTable } from "@/features/clients/view/ClientAccountTable";
import { AppToast } from "@/shared/components/app-toast";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface ClientsPageProps {
  lifecycleBucket: ClientLifecycleStatus;
}

export function ClientsPage({ lifecycleBucket }: ClientsPageProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const {
    clientView,
    clientsQuery,
    company,
    createMutation,
    defaultValues,
    errorMessage,
    filteredClientCount,
    filteredClients,
    isEditorOpen,
    isEditing,
    lifecycleCounts,
    openCreateEditor,
    openEditEditor,
    pagedClients,
    selectedClient,
    closeEditor,
    clearSuccessMessage,
    resetClientFilters,
    setClientsActiveState,
    successMessage,
    updateMutation,
  } = useClientsController(lifecycleBucket);
  const clientSelection = useBulkSelection<number>();
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const selectedClients = filteredClients.filter((client) => clientSelection.selectedIds.includes(client.id));

  useEffect(() => {
    clientSelection.clearSelection();
  }, [clientSelection.clearSelection, clientView.queryFilters, lifecycleBucket]);

  const isSuccessToastOpen = !isEditorOpen && Boolean(successMessage);

  return (
    <Stack spacing={2} sx={{ height: "100%", minHeight: 0, overflow: "hidden" }}>
      {!company ? (
        <Alert severity="info">
          {t("Select an active workspace membership before managing client accounts.")}
        </Alert>
      ) : null}
      {!isEditorOpen && errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <ClientAccountTable
        clients={pagedClients}
        dataView={clientView}
        error={clientsQuery.error ? parseApiError(clientsQuery.error) : null}
        exportRows={filteredClients}
        isLoading={clientsQuery.isLoading}
        isWorkspaceReady={Boolean(company)}
        lifecycleBucket={lifecycleBucket}
        lifecycleCounts={lifecycleCounts}
        onOpenBatchAssign={() => {
          setInfoMessage(t("Batch charging-template assignment is planned but is not wired to the backend yet."));
        }}
        onEdit={openEditEditor}
        onLifecycleBucketChange={(nextBucket) => navigate(buildClientLifecyclePath(nextBucket))}
        onOpenCreate={openCreateEditor}
        onOpenDistributionPermissions={() => {
          setInfoMessage(t("Distribution permission updates will be enabled once the client permission APIs are available."));
        }}
        onOpenPortalAccess={() => {
          setInfoMessage(t("Client-scoped portal access management is planned but not yet wired to the IAM API."));
        }}
        onResetPassword={(client) => {
          setInfoMessage(t("Password reset for {{name}} will be enabled once the client IAM API is available.", { name: client.name }));
        }}
        onObtainToken={(client) => {
          setInfoMessage(t("Token issuance for {{name}} will be enabled once the client IAM API is available.", { name: client.name }));
        }}
        onResetFilters={resetClientFilters}
        onToggleActive={async (client, nextActive) => {
          setInfoMessage(null);
          await setClientsActiveState([client], nextActive);
        }}
        rowSelection={{
          onToggleAll: (rows) => clientSelection.toggleMany(rows.map((row) => row.id)),
          onToggleRow: (row) => clientSelection.toggleOne(row.id),
          selectedRowIds: clientSelection.selectedIds,
        }}
        selectedClients={selectedClients}
        selectedCount={clientSelection.selectedCount}
        onBulkDeactivate={async () => {
          setInfoMessage(null);
          await setClientsActiveState(selectedClients, false);
          clientSelection.clearSelection();
        }}
        onBulkReactivate={async () => {
          setInfoMessage(null);
          await setClientsActiveState(selectedClients, true);
          clientSelection.clearSelection();
        }}
        onClearSelection={clientSelection.clearSelection}
        total={filteredClientCount}
      />
      <ClientAccountForm
        client={selectedClient}
        defaultValues={defaultValues}
        errorMessage={errorMessage}
        isEditing={isEditing}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={closeEditor}
        onSubmit={(values) => (isEditing ? updateMutation.mutateAsync(values) : createMutation.mutateAsync(values))}
        open={isEditorOpen}
        successMessage={successMessage}
      />
      <AppToast message={infoMessage} onClose={() => setInfoMessage(null)} open={Boolean(infoMessage)} severity="info" />
      <AppToast message={successMessage} onClose={clearSuccessMessage} open={isSuccessToastOpen} severity="success" />
    </Stack>
  );
}

export function ClientsPendingApprovalPage() {
  return <ClientsPage lifecycleBucket="PENDING_APPROVAL" />;
}

export function ClientsApprovedPage() {
  return <ClientsPage lifecycleBucket="APPROVED" />;
}

export function ClientsReviewNotApprovedPage() {
  return <ClientsPage lifecycleBucket="REVIEW_NOT_APPROVED" />;
}

export function ClientsDeactivatedPage() {
  return <ClientsPage lifecycleBucket="DEACTIVATED" />;
}
