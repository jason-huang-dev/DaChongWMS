import Grid from "@mui/material/Grid";
import { Alert, Stack } from "@mui/material";

import { useClientsController } from "@/features/clients/controller/useClientsController";
import { ClientAccountForm } from "@/features/clients/view/ClientAccountForm";
import { ClientAccountTable } from "@/features/clients/view/ClientAccountTable";
import { PageHeader } from "@/shared/components/page-header";
import { SummaryCard } from "@/shared/components/summary-card";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function ClientsPage() {
  const {
    activeWarehouse,
    clearSelection,
    clientView,
    clientsQuery,
    company,
    createMutation,
    defaultValues,
    errorMessage,
    filteredClientCount,
    isEditing,
    pagedClients,
    selectedClient,
    setSelectedClient,
    successMessage,
    summary,
    updateMutation,
  } = useClientsController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Manage client accounts for dropshipping workflows, inbound stock submissions, and portal-linked customer visibility."
        title="Client management"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current workspace and warehouse context for client operations."
            items={[
              { label: "Workspace", value: company?.label ?? "No workspace selected" },
              { label: "Warehouse context", value: activeWarehouse?.warehouse_name ?? "All warehouses" },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Top-level client account volume."
            items={[
              { label: "All clients", value: String(summary.total) },
              { label: "Active clients", value: String(summary.active) },
            ]}
            title="Coverage"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Clients allowed to place dropshipping demand."
            items={[
              { label: "Dropship enabled", value: String(summary.dropshipEnabled) },
              { label: "Inbound enabled", value: String(summary.inboundEnabled) },
            ]}
            title="Workflow rights"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="The current filtered working set."
            items={[
              { label: "Filtered result count", value: String(filteredClientCount) },
              { label: "Selected client", value: selectedClient?.name ?? "None" },
            ]}
            title="Current view"
          />
        </Grid>
        {!company ? (
          <Grid size={{ xs: 12 }}>
            <Alert severity="info">
              Select an active workspace membership before managing client accounts.
            </Alert>
          </Grid>
        ) : null}
        <Grid size={{ xs: 12, xl: 4 }}>
          <ClientAccountForm
            defaultValues={defaultValues}
            errorMessage={errorMessage}
            isEditing={isEditing}
            isSubmitting={createMutation.isPending || updateMutation.isPending}
            onCancelEdit={clearSelection}
            onSubmit={(values) => (isEditing ? updateMutation.mutateAsync(values) : createMutation.mutateAsync(values))}
            successMessage={successMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ClientAccountTable
            activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
            clients={pagedClients}
            companyLabel={company?.label ?? null}
            dataView={clientView}
            error={clientsQuery.error ? parseApiError(clientsQuery.error) : null}
            isLoading={clientsQuery.isLoading}
            onEdit={setSelectedClient}
            total={filteredClientCount}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
