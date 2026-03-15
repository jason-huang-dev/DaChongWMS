import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";

import type {
  AutomationAlertRecord,
  BackgroundTaskRecord,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
} from "@/features/automation/model/types";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface AutomationTableProps {
  alertsQuery: PaginatedQueryState<AutomationAlertRecord>;
  backgroundTasksQuery: PaginatedQueryState<BackgroundTaskRecord>;
  isRetryingTask: boolean;
  isRunningNow: boolean;
  onRetryTask: (backgroundTaskId: number) => void;
  onRunNow: (scheduledTaskId: number) => void;
  scheduledTasksQuery: PaginatedQueryState<ScheduledTaskRecord>;
  workerHeartbeatsQuery: PaginatedQueryState<WorkerHeartbeatRecord>;
}

export function AutomationTable({
  alertsQuery,
  backgroundTasksQuery,
  isRetryingTask,
  isRunningNow,
  onRetryTask,
  onRunNow,
  scheduledTasksQuery,
  workerHeartbeatsQuery,
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
          rows={scheduledTasksQuery.data?.results ?? []}
          subtitle="Configured schedules that enqueue reporting, finance, and integration work."
          title="Scheduled tasks"
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
          rows={backgroundTasksQuery.data?.results ?? []}
          subtitle="Current queue state and failed work that may need re-queuing."
          title="Background tasks"
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
          rows={workerHeartbeatsQuery.data?.results ?? []}
          subtitle="Latest worker heartbeats for the DB-backed automation queue."
          title="Worker heartbeats"
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
          rows={alertsQuery.data?.results ?? []}
          subtitle="Open automation alerts raised from dead tasks, retry backlogs, and stale workers."
          title="Automation alerts"
        />
      </Grid>
    </Grid>
  );
}
