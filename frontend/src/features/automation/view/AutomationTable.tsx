import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";

import type {
  AutomationAlertRecord,
  BackgroundTaskRecord,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
} from "@/features/automation/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const scheduledTaskFields: DataViewFieldConfig<{ task_type: string; is_active: string }>[] = [
  { key: "task_type", label: "Task type", placeholder: "EXPORT_FINANCE" },
  {
    key: "is_active",
    label: "State",
    type: "select",
    options: [
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
];

const backgroundTaskFields: DataViewFieldConfig<{ task_type: string; status: string; reference_code__icontains: string }>[] = [
  { key: "task_type", label: "Task type", placeholder: "INTEGRATION_JOB" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Queued", value: "QUEUED" },
      { label: "Running", value: "RUNNING" },
      { label: "Retry", value: "RETRY" },
      { label: "Dead", value: "DEAD" },
      { label: "Succeeded", value: "SUCCEEDED" },
    ],
  },
  { key: "reference_code__icontains", label: "Reference", placeholder: "TASK-1001" },
];

const workerFields: DataViewFieldConfig<{ worker_name__icontains: string }>[] = [
  { key: "worker_name__icontains", label: "Worker", placeholder: "worker-01" },
];

const alertFields: DataViewFieldConfig<{ status: string; severity: string; alert_type: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Resolved", value: "RESOLVED" },
    ],
  },
  {
    key: "severity",
    label: "Severity",
    type: "select",
    options: [
      { label: "Warning", value: "WARNING" },
      { label: "Critical", value: "CRITICAL" },
    ],
  },
  { key: "alert_type", label: "Alert type", placeholder: "STALE_WORKER" },
];

interface AutomationTableProps {
  activeWarehouseName?: string | null;
  alertsQuery: PaginatedQueryState<AutomationAlertRecord>;
  alertsView: UseDataViewResult<{ status: string; severity: string; alert_type: string }>;
  backgroundTasksQuery: PaginatedQueryState<BackgroundTaskRecord>;
  backgroundTasksView: UseDataViewResult<{ task_type: string; status: string; reference_code__icontains: string }>;
  isRetryingTask: boolean;
  isRunningNow: boolean;
  onRetryTask: (backgroundTaskId: number) => void;
  onRunNow: (scheduledTaskId: number) => void;
  scheduledTasksQuery: PaginatedQueryState<ScheduledTaskRecord>;
  scheduledTasksView: UseDataViewResult<{ task_type: string; is_active: string }>;
  workerHeartbeatsQuery: PaginatedQueryState<WorkerHeartbeatRecord>;
  workerHeartbeatsView: UseDataViewResult<{ worker_name__icontains: string }>;
}

export function AutomationTable({
  activeWarehouseName,
  alertsQuery,
  alertsView,
  backgroundTasksQuery,
  backgroundTasksView,
  isRetryingTask,
  isRunningNow,
  onRetryTask,
  onRunNow,
  scheduledTasksQuery,
  scheduledTasksView,
  workerHeartbeatsQuery,
  workerHeartbeatsView,
}: AutomationTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            {
              header: "Schedule",
              key: "schedule",
              render: (row) => <RecordLink to={`/automation/scheduled-tasks/${row.id}`}>{row.name}</RecordLink>,
            },
            { header: "Task type", key: "type", render: (row) => row.task_type },
            { header: "Next run", key: "nextRun", render: (row) => formatDateTime(row.next_run_at) },
            { header: "Active", key: "active", render: (row) => (row.is_active ? "Yes" : "No") },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button disabled={isRunningNow || !row.is_active} onClick={() => onRunNow(row.id)} size="small" variant="contained">
                  Run now
                </Button>
              ),
            },
          ]}
          error={scheduledTasksQuery.error ? parseApiError(scheduledTasksQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={scheduledTasksQuery.isLoading}
          pagination={{
            page: scheduledTasksView.page,
            pageSize: scheduledTasksView.pageSize,
            total: scheduledTasksQuery.data?.count ?? 0,
            onPageChange: scheduledTasksView.setPage,
          }}
          rows={scheduledTasksQuery.data?.results ?? []}
          subtitle="Configured schedules that enqueue reporting, finance, and integration work."
          title="Scheduled tasks"
          toolbar={
            <DataViewToolbar
              activeFilterCount={scheduledTasksView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={scheduledTaskFields}
              filters={scheduledTasksView.filters}
              onChange={scheduledTasksView.updateFilter}
              onReset={scheduledTasksView.resetFilters}
              resultCount={scheduledTasksQuery.data?.count}
              savedViews={{
                items: scheduledTasksView.savedViews,
                selectedId: scheduledTasksView.selectedSavedViewId,
                onApply: scheduledTasksView.applySavedView,
                onDelete: scheduledTasksView.deleteSavedView,
                onSave: scheduledTasksView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            {
              header: "Task",
              key: "task",
              render: (row) => (
                <RecordLink to={`/automation/background-tasks/${row.id}`}>
                  {row.reference_code || `Task ${row.id}`}
                </RecordLink>
              ),
            },
            { header: "Type", key: "type", render: (row) => row.task_type },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            { header: "Available", key: "available", render: (row) => formatDateTime(row.available_at) },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isRetryingTask || !["DEAD", "RETRY"].includes(row.status)}
                  onClick={() => onRetryTask(row.id)}
                  size="small"
                  variant="outlined"
                >
                  Retry
                </Button>
              ),
            },
          ]}
          error={backgroundTasksQuery.error ? parseApiError(backgroundTasksQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={backgroundTasksQuery.isLoading}
          pagination={{
            page: backgroundTasksView.page,
            pageSize: backgroundTasksView.pageSize,
            total: backgroundTasksQuery.data?.count ?? 0,
            onPageChange: backgroundTasksView.setPage,
          }}
          rows={backgroundTasksQuery.data?.results ?? []}
          subtitle="Current queue state and failed work that may need re-queuing."
          title="Background tasks"
          toolbar={
            <DataViewToolbar
              activeFilterCount={backgroundTasksView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={backgroundTaskFields}
              filters={backgroundTasksView.filters}
              onChange={backgroundTasksView.updateFilter}
              onReset={backgroundTasksView.resetFilters}
              resultCount={backgroundTasksQuery.data?.count}
              savedViews={{
                items: backgroundTasksView.savedViews,
                selectedId: backgroundTasksView.selectedSavedViewId,
                onApply: backgroundTasksView.applySavedView,
                onDelete: backgroundTasksView.deleteSavedView,
                onSave: backgroundTasksView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Worker", key: "worker", render: (row) => row.worker_name },
            { header: "Last seen", key: "lastSeen", render: (row) => formatDateTime(row.last_seen_at) },
            { header: "Processed", key: "processed", render: (row) => row.processed_count },
            { header: "Queue depth", key: "queueDepth", render: (row) => row.queue_depth },
            { header: "Last error", key: "error", render: (row) => row.last_error || "--" },
          ]}
          error={workerHeartbeatsQuery.error ? parseApiError(workerHeartbeatsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={workerHeartbeatsQuery.isLoading}
          pagination={{
            page: workerHeartbeatsView.page,
            pageSize: workerHeartbeatsView.pageSize,
            total: workerHeartbeatsQuery.data?.count ?? 0,
            onPageChange: workerHeartbeatsView.setPage,
          }}
          rows={workerHeartbeatsQuery.data?.results ?? []}
          subtitle="Latest worker heartbeats for the DB-backed automation queue."
          title="Worker heartbeats"
          toolbar={
            <DataViewToolbar
              activeFilterCount={workerHeartbeatsView.activeFilterCount}
              fields={workerFields}
              filters={workerHeartbeatsView.filters}
              onChange={workerHeartbeatsView.updateFilter}
              onReset={workerHeartbeatsView.resetFilters}
              resultCount={workerHeartbeatsQuery.data?.count}
              savedViews={{
                items: workerHeartbeatsView.savedViews,
                selectedId: workerHeartbeatsView.selectedSavedViewId,
                onApply: workerHeartbeatsView.applySavedView,
                onDelete: workerHeartbeatsView.deleteSavedView,
                onSave: workerHeartbeatsView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            { header: "Alert", key: "alert", render: (row) => row.summary },
            { header: "Type", key: "type", render: (row) => row.alert_type },
            { header: "Severity", key: "severity", render: (row) => row.severity },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            { header: "Opened", key: "opened", render: (row) => formatDateTime(row.opened_at) },
          ]}
          error={alertsQuery.error ? parseApiError(alertsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={alertsQuery.isLoading}
          pagination={{
            page: alertsView.page,
            pageSize: alertsView.pageSize,
            total: alertsQuery.data?.count ?? 0,
            onPageChange: alertsView.setPage,
          }}
          rows={alertsQuery.data?.results ?? []}
          subtitle="Open automation alerts raised from dead tasks, retry backlogs, and stale workers."
          title="Automation alerts"
          toolbar={
            <DataViewToolbar
              activeFilterCount={alertsView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={alertFields}
              filters={alertsView.filters}
              onChange={alertsView.updateFilter}
              onReset={alertsView.resetFilters}
              resultCount={alertsQuery.data?.count}
              savedViews={{
                items: alertsView.savedViews,
                selectedId: alertsView.selectedSavedViewId,
                onApply: alertsView.applySavedView,
                onDelete: alertsView.deleteSavedView,
                onSave: alertsView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
    </Grid>
  );
}
