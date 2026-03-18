import Grid from "@mui/material/Grid";
import { Alert, Stack, TextField } from "@mui/material";

import { useCountingController } from "@/features/counting/controller/useCountingController";
import { CountingTable } from "@/features/counting/view/CountingTable";
import { ScannerTaskPanel } from "@/features/counting/view/components/ScannerTaskPanel";
import { BulkActionBar } from "@/shared/components/bulk-action-bar";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const assignmentFields: DataViewFieldConfig<{ scanner_task_type: string; scanner_task_status: string }>[] = [
  {
    key: "scanner_task_type",
    label: "Task type",
    type: "select",
    options: [
      { label: "Count", value: "COUNT" },
      { label: "Recount", value: "RECOUNT" },
    ],
  },
  {
    key: "scanner_task_status",
    label: "Scanner state",
    type: "select",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Acknowledged", value: "ACKNOWLEDGED" },
      { label: "In progress", value: "IN_PROGRESS" },
      { label: "Completed", value: "COMPLETED" },
    ],
  },
];

export function CountingPage() {
  const {
    activeWarehouse,
    assignmentsQuery,
    assignmentsView,
    bulkActionErrorMessage,
    bulkActionSuccessMessage,
    bulkDecisionMutation,
    bulkDecisionNotes,
    dashboardQuery,
    nextTaskQuery,
    queueQuery,
    queueSelection,
    queueView,
    setBulkDecisionNotes,
  } = useCountingController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Assignment visibility for handheld counters plus scan-first task completion and the supervisor queue for variance approvals and recount breaches."
        title="Counting"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Pending approvals" value={dashboardQuery.data?.pending_total ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Approval SLA breaches" value={dashboardQuery.data?.pending_sla_breach_count ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard label="Recount SLA breaches" value={dashboardQuery.data?.recount_sla_breach_count ?? "--"} />
        </Grid>
        <Grid size={{ xs: 12, md: 6, lg: 3 }}>
          <MetricCard
            helper={nextTaskQuery.data ? `${nextTaskQuery.data.location_code} | ${nextTaskQuery.data.goods_code}` : "No scanner task currently assigned."}
            label="Next handheld task"
            value={nextTaskQuery.data?.task_type ?? "--"}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12 }}>
          <ScannerTaskPanel
            errorMessage={nextTaskQuery.isError ? parseApiError(nextTaskQuery.error) : null}
            isLoading={nextTaskQuery.isLoading}
            task={nextTaskQuery.data}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Count line", key: "line", render: (row) => `${row.cycle_count}-${row.line_number}` },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Task", key: "task", render: (row) => row.scanner_task_type || "COUNT" },
              { header: "Task status", key: "taskStatus", render: (row) => <StatusChip status={row.scanner_task_status || row.status} /> },
              { header: "Counted qty", key: "counted", align: "right", render: (row) => formatNumber(row.counted_qty) },
            ]}
            error={assignmentsQuery.error ? parseApiError(assignmentsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={assignmentsQuery.isLoading}
            pagination={{
              page: assignmentsView.page,
              pageSize: assignmentsView.pageSize,
              total: assignmentsQuery.data?.count ?? 0,
              onPageChange: assignmentsView.setPage,
            }}
            rows={assignmentsQuery.data?.results ?? []}
            subtitle="Current counter assignments for the logged-in operator"
            title="My assignments"
            toolbar={
              <DataViewToolbar
                activeFilterCount={assignmentsView.activeFilterCount}
                fields={assignmentFields}
                filters={assignmentsView.filters}
                onChange={assignmentsView.updateFilter}
                onReset={assignmentsView.resetFilters}
                resultCount={assignmentsQuery.data?.count}
                savedViews={{
                  items: assignmentsView.savedViews,
                  selectedId: assignmentsView.selectedSavedViewId,
                  onApply: assignmentsView.applySavedView,
                  onDelete: assignmentsView.deleteSavedView,
                  onSave: assignmentsView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ExceptionLane
            columns={[
              {
                header: "Count",
                key: "count",
                render: (row) => <RecordLink to={`/counting/approvals/${row.approval_id}`}>{row.count_number}</RecordLink>,
              },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
              { header: "Required role", key: "role", render: (row) => row.required_role },
              { header: "Age", key: "age", align: "right", render: (row) => `${row.age_hours.toFixed(1)}h` },
            ]}
            error={dashboardQuery.error ? parseApiError(dashboardQuery.error) : null}
            getRowId={(row) => row.approval_id}
            isLoading={dashboardQuery.isLoading}
            rows={dashboardQuery.data?.pending_oldest_items ?? []}
            severity="warning"
            subtitle="Oldest pending approvals from the supervisor dashboard."
            title="Blocked counts: approval breaches"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ExceptionLane
            columns={[
              {
                header: "Count",
                key: "count",
                render: (row) => <RecordLink to={`/counting/approvals/${row.approval_id}`}>{row.count_number}</RecordLink>,
              },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
              { header: "Assigned recount", key: "assigned", render: (row) => row.recount_assigned_to || "--" },
              { header: "Age", key: "age", align: "right", render: (row) => `${row.age_hours.toFixed(1)}h` },
            ]}
            emptyMessage="No recount SLA breaches."
            error={dashboardQuery.error ? parseApiError(dashboardQuery.error) : null}
            getRowId={(row) => `${row.approval_id}-${row.count_number}`}
            isLoading={dashboardQuery.isLoading}
            rows={dashboardQuery.data?.recount_items ?? []}
            severity="error"
            subtitle="Rejected or reassigned counts that are already beyond the recount SLA."
            title="Blocked counts: recount breaches"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          {bulkActionSuccessMessage ? <Alert severity="success">{bulkActionSuccessMessage}</Alert> : null}
          {bulkActionErrorMessage ? <Alert severity="error">{bulkActionErrorMessage}</Alert> : null}
          <CountingTable
            error={queueQuery.error ? parseApiError(queueQuery.error) : null}
            isLoading={queueQuery.isLoading}
            activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
            dataView={queueView}
            rows={queueQuery.data?.results ?? []}
            rowSelection={{
              selectedRowIds: queueSelection.selectedIds,
              onToggleAll: (rows) => queueSelection.toggleMany(rows.map((row) => row.id)),
              onToggleRow: (row) => queueSelection.toggleOne(row.id),
              isRowSelectable: (row) => ["PENDING", "REJECTED"].includes(row.status),
            }}
            toolbarContent={
              <BulkActionBar
                actions={[
                  {
                    key: "approve",
                    label: "Approve selected",
                    onClick: () =>
                      bulkDecisionMutation.mutate({
                        action: "approve",
                        approvalIds: queueSelection.selectedIds.map(Number),
                        notes: bulkDecisionNotes,
                      }),
                    disabled: bulkDecisionMutation.isPending,
                    color: "success",
                  },
                  {
                    key: "reject",
                    label: "Reject selected",
                    onClick: () =>
                      bulkDecisionMutation.mutate({
                        action: "reject",
                        approvalIds: queueSelection.selectedIds.map(Number),
                        notes: bulkDecisionNotes,
                      }),
                    disabled: bulkDecisionMutation.isPending,
                    color: "error",
                    variant: "outlined",
                  },
                ]}
                extraControls={
                  <TextField
                    label="Decision notes"
                    onChange={(event) => setBulkDecisionNotes(event.target.value)}
                    placeholder="Optional note applied to every selected approval"
                    size="small"
                    value={bulkDecisionNotes}
                  />
                }
                helperText="Apply the same supervisor decision to the selected approval rows."
                onClear={queueSelection.clearSelection}
                selectedCount={queueSelection.selectedCount}
              />
            }
            total={queueQuery.data?.count ?? 0}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
