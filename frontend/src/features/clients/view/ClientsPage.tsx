import { useEffect, useState } from "react";

import { Alert, Stack } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useClientsController } from "@/features/clients/controller/useClientsController";
import {
  buildClientLifecyclePath,
} from "@/features/clients/model/client-accounts";
import type { ClientLifecycleStatus } from "@/features/clients/model/types";
import { ClientAccountForm } from "@/features/clients/view/ClientAccountForm";
import { ClientAccountTable } from "@/features/clients/view/ClientAccountTable";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface ClientsPageProps {
  lifecycleBucket: ClientLifecycleStatus;
}

export function ClientsPage({ lifecycleBucket }: ClientsPageProps) {
  const navigate = useNavigate();
  const {
    clientView,
    clientsQuery,
    company,
    createMutation,
    defaultValues,
    errorMessage,
    filterOptions,
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

  return (
    <Stack spacing={2}>
      {!company ? (
        <Alert severity="info">
          Select an active workspace membership before managing client accounts.
        </Alert>
      ) : null}
      {infoMessage ? (
        <Alert onClose={() => setInfoMessage(null)} severity="info">
          {infoMessage}
        </Alert>
      ) : null}
      {!isEditorOpen && successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!isEditorOpen && errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <ClientAccountTable
        clients={pagedClients}
        dataView={clientView}
        error={clientsQuery.error ? parseApiError(clientsQuery.error) : null}
        exportRows={filteredClients}
        filterOptions={filterOptions}
        isLoading={clientsQuery.isLoading}
        isWorkspaceReady={Boolean(company)}
        lifecycleBucket={lifecycleBucket}
        lifecycleCounts={lifecycleCounts}
        onOpenBatchAssign={() => {
          setInfoMessage("Batch charging-template assignment is planned but is not wired to the backend yet.");
        }}
        onEdit={openEditEditor}
        onLifecycleBucketChange={(nextBucket) => navigate(buildClientLifecyclePath(nextBucket))}
        onOpenCreate={openCreateEditor}
        onOpenDistributionPermissions={() => {
          setInfoMessage("Distribution permission updates will be enabled once the client permission APIs are available.");
        }}
        onOpenOmsLoginDirectory={() => {
          setInfoMessage("OMS login URL shortcuts will be enabled once the backend exposes workspace-level client login links.");
        }}
        onOpenOmsLogin={(client) => {
          if (client.oms_login_url && typeof window !== "undefined") {
            window.open(client.oms_login_url, "_blank", "noopener,noreferrer");
            return;
          }
          setInfoMessage("OMS login redirect will be enabled once the backend exposes client-specific login URLs.");
        }}
        onOpenPortalAccess={() => {
          setInfoMessage("Client-scoped portal access management is planned but not yet wired to the IAM API.");
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
