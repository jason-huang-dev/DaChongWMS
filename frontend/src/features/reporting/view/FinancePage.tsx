import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useReportingController } from "@/features/reporting/controller/useReportingController";
import { FinanceTable } from "@/features/reporting/view/FinanceTable";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { PageHeader } from "@/shared/components/page-header";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const settlementFields: DataViewFieldConfig<{ status: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending approval", value: "PENDING_APPROVAL" },
      { label: "Approved", value: "APPROVED" },
      { label: "Partially remitted", value: "PARTIALLY_REMITTED" },
      { label: "Remitted", value: "REMITTED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

const disputeFields: DataViewFieldConfig<{ status: string; reason_code: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Under review", value: "UNDER_REVIEW" },
      { label: "Resolved", value: "RESOLVED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
  { key: "reason_code", label: "Reason", placeholder: "RATE" },
];

const exportFields: DataViewFieldConfig<{ status: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Generated", value: "GENERATED" },
      { label: "Expired", value: "EXPIRED" },
    ],
  },
];

export function FinancePage() {
  const {
    activeWarehouse,
    disputesQuery,
    disputesView,
    exportsQuery,
    exportsView,
    invoicesQuery,
    invoicesView,
    settlementsQuery,
    settlementsView,
  } = useReportingController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Finance review surface for invoices, settlements, disputes, and exported remittance packs."
        title="Finance"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <FinanceTable
            activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
            dataView={invoicesView}
            error={invoicesQuery.error ? parseApiError(invoicesQuery.error) : null}
            isLoading={invoicesQuery.isLoading}
            rows={invoicesQuery.data?.results ?? []}
            total={invoicesQuery.data?.count ?? 0}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Settlement", key: "settlement", render: (row) => row.settlement_reference },
              { header: "Requested", key: "requested", align: "right", render: (row) => formatNumber(row.requested_amount) },
              { header: "Approved", key: "approved", align: "right", render: (row) => formatNumber(row.approved_amount) },
              { header: "Remitted", key: "remitted", align: "right", render: (row) => formatNumber(row.remitted_amount) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={settlementsQuery.error ? parseApiError(settlementsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={settlementsQuery.isLoading}
            pagination={{
              page: settlementsView.page,
              pageSize: settlementsView.pageSize,
              total: settlementsQuery.data?.count ?? 0,
              onPageChange: settlementsView.setPage,
            }}
            rows={settlementsQuery.data?.results ?? []}
            subtitle="Settlement and remittance workflow"
            title="Settlements"
            toolbar={
              <DataViewToolbar
                activeFilterCount={settlementsView.activeFilterCount}
                fields={settlementFields}
                filters={settlementsView.filters}
                onChange={settlementsView.updateFilter}
                onReset={settlementsView.resetFilters}
                resultCount={settlementsQuery.data?.count}
                savedViews={{
                  items: settlementsView.savedViews,
                  selectedId: settlementsView.selectedSavedViewId,
                  onApply: settlementsView.applySavedView,
                  onDelete: settlementsView.deleteSavedView,
                  onSave: settlementsView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Reference", key: "reference", render: (row) => row.dispute_reference },
              { header: "Amount", key: "amount", align: "right", render: (row) => formatNumber(row.disputed_amount) },
              { header: "Reason", key: "reason", render: (row) => row.reason_code },
              { header: "Submitted", key: "submitted", render: (row) => formatDateTime(row.submitted_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={disputesQuery.error ? parseApiError(disputesQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={disputesQuery.isLoading}
            pagination={{
              page: disputesView.page,
              pageSize: disputesView.pageSize,
              total: disputesQuery.data?.count ?? 0,
              onPageChange: disputesView.setPage,
            }}
            rows={disputesQuery.data?.results ?? []}
            subtitle="Open and recently resolved invoice disputes"
            title="Disputes"
            toolbar={
              <DataViewToolbar
                activeFilterCount={disputesView.activeFilterCount}
                fields={disputeFields}
                filters={disputesView.filters}
                onChange={disputesView.updateFilter}
                onReset={disputesView.resetFilters}
                resultCount={disputesQuery.data?.count}
                savedViews={{
                  items: disputesView.savedViews,
                  selectedId: disputesView.selectedSavedViewId,
                  onApply: disputesView.applySavedView,
                  onDelete: disputesView.deleteSavedView,
                  onSave: disputesView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "Export", key: "export", render: (row) => row.file_name || `finance-export-${row.id}.csv` },
              { header: "Rows", key: "rows", align: "right", render: (row) => formatNumber(row.row_count) },
              { header: "Generated at", key: "generatedAt", render: (row) => formatDateTime(row.generated_at) },
              { header: "Generated by", key: "generatedBy", render: (row) => row.generated_by || "--" },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={exportsQuery.error ? parseApiError(exportsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={exportsQuery.isLoading}
            pagination={{
              page: exportsView.page,
              pageSize: exportsView.pageSize,
              total: exportsQuery.data?.count ?? 0,
              onPageChange: exportsView.setPage,
            }}
            rows={exportsQuery.data?.results ?? []}
            subtitle="Latest finance export runs ready for downstream accounting"
            title="Finance exports"
            toolbar={
              <DataViewToolbar
                activeFilterCount={exportsView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={exportFields}
                filters={exportsView.filters}
                onChange={exportsView.updateFilter}
                onReset={exportsView.resetFilters}
                resultCount={exportsQuery.data?.count}
                savedViews={{
                  items: exportsView.savedViews,
                  selectedId: exportsView.selectedSavedViewId,
                  onApply: exportsView.applySavedView,
                  onDelete: exportsView.deleteSavedView,
                  onSave: exportsView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
