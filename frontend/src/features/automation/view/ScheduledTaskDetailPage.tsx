import { Alert, Button, Stack } from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useScheduledTaskDetailController } from "@/features/automation/controller/useAutomationController";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";
import { JsonBlock } from "@/shared/components/json-block";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { RouteFallback } from "@/shared/components/route-fallback";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function ScheduledTaskDetailPage() {
  const { scheduledTaskId } = useParams<{ scheduledTaskId: string }>();
  const { alertsQuery, backgroundTasksQuery, errorMessage, runNowMutation, scheduledTaskQuery, successMessage } =
    useScheduledTaskDetailController(scheduledTaskId);

  if (!scheduledTaskId) {
    return <Navigate replace to="/automation" />;
  }

  if (scheduledTaskQuery.isLoading) {
    return <RouteFallback />;
  }

  const scheduledTask = scheduledTaskQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={runNowMutation.isPending || !scheduledTask?.is_active}
              onClick={() => runNowMutation.mutate()}
              variant="contained"
            >
              {runNowMutation.isPending ? "Queueing..." : "Run now"}
            </Button>
            <Button component={RouterLink} to="/automation" variant="outlined">
              Back to automation
            </Button>
          </Stack>
        }
        description="Inspect schedule configuration, payload, and the background tasks and alerts generated from the automation schedule."
        title="Scheduled task detail"
      />
      <QueryAlert message={scheduledTaskQuery.error ? parseApiError(scheduledTaskQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!scheduledTask ? null : (
        <>
          <DetailCard description="Core scheduling fields returned by the automation API." title="Schedule summary">
            <DetailGrid
              items={[
                { label: "Name", value: scheduledTask.name },
                { label: "Task type", value: scheduledTask.task_type },
                { label: "Status", value: scheduledTask.is_active ? "Active" : "Inactive" },
                { label: "Warehouse", value: scheduledTask.warehouse ?? "--" },
                { label: "Customer", value: scheduledTask.customer ?? "--" },
                { label: "Interval", value: `${scheduledTask.interval_minutes} minutes` },
                { label: "Priority", value: scheduledTask.priority },
                { label: "Max attempts", value: scheduledTask.max_attempts },
                { label: "Next run", value: formatDateTime(scheduledTask.next_run_at) },
                { label: "Last enqueued", value: formatDateTime(scheduledTask.last_enqueued_at) },
                { label: "Last completed", value: formatDateTime(scheduledTask.last_completed_at) },
                { label: "Last error", value: scheduledTask.last_error || "--" },
              ]}
            />
          </DetailCard>
          <DetailCard description="Backend payload and notes for this schedule." title="Schedule configuration">
            <Stack spacing={2}>
              <JsonBlock value={scheduledTask.payload} />
              <DetailGrid items={[{ label: "Notes", value: scheduledTask.notes || "--" }]} />
            </Stack>
          </DetailCard>
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
              { header: "Started", key: "started", render: (row) => formatDateTime(row.started_at) },
              { header: "Completed", key: "completed", render: (row) => formatDateTime(row.completed_at) },
            ]}
            error={backgroundTasksQuery.error ? parseApiError(backgroundTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={backgroundTasksQuery.isLoading}
            rows={backgroundTasksQuery.data?.results ?? []}
            subtitle="Background tasks generated from this scheduled task."
            title="Related background tasks"
          />
          <ResourceTable
            columns={[
              { header: "Alert", key: "summary", render: (row) => row.summary },
              { header: "Type", key: "type", render: (row) => row.alert_type },
              { header: "Severity", key: "severity", render: (row) => row.severity },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
              { header: "Opened", key: "opened", render: (row) => formatDateTime(row.opened_at) },
            ]}
            error={alertsQuery.error ? parseApiError(alertsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={alertsQuery.isLoading}
            rows={alertsQuery.data?.results ?? []}
            subtitle="Automation alerts currently attached to this schedule."
            title="Related alerts"
          />
        </>
      )}
    </Stack>
  );
}
