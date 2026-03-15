import { Alert, Button, Stack } from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useBackgroundTaskDetailController } from "@/features/automation/controller/useAutomationController";
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

export function BackgroundTaskDetailPage() {
  const { backgroundTaskId } = useParams<{ backgroundTaskId: string }>();
  const { alertsQuery, backgroundTaskQuery, errorMessage, retryMutation, successMessage } =
    useBackgroundTaskDetailController(backgroundTaskId);

  if (!backgroundTaskId) {
    return <Navigate replace to="/automation" />;
  }

  if (backgroundTaskQuery.isLoading) {
    return <RouteFallback />;
  }

  const backgroundTask = backgroundTaskQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={retryMutation.isPending || !["DEAD", "RETRY"].includes(backgroundTask?.status ?? "")}
              onClick={() => retryMutation.mutate()}
              variant="contained"
            >
              {retryMutation.isPending ? "Retrying..." : "Retry task"}
            </Button>
            <Button component={RouterLink} to="/automation" variant="outlined">
              Back to automation
            </Button>
          </Stack>
        }
        description="Inspect queue state, execution payloads, and related alerts for a single background task."
        title="Background task detail"
      />
      <QueryAlert message={backgroundTaskQuery.error ? parseApiError(backgroundTaskQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!backgroundTask ? null : (
        <>
          <DetailCard description="Queue timing, ownership, and related record links for the selected task." title="Task summary">
            <DetailGrid
              items={[
                { label: "Reference", value: backgroundTask.reference_code || `Task ${backgroundTask.id}` },
                { label: "Task type", value: backgroundTask.task_type },
                { label: "Status", value: <StatusChip status={backgroundTask.status} /> },
                {
                  label: "Scheduled task",
                  value: backgroundTask.scheduled_task ? (
                    <RecordLink to={`/automation/scheduled-tasks/${backgroundTask.scheduled_task}`}>
                      Schedule {backgroundTask.scheduled_task}
                    </RecordLink>
                  ) : (
                    "--"
                  ),
                },
                { label: "Integration job", value: backgroundTask.integration_job ?? "--" },
                { label: "Warehouse", value: backgroundTask.warehouse ?? "--" },
                { label: "Customer", value: backgroundTask.customer ?? "--" },
                { label: "Priority", value: backgroundTask.priority },
                { label: "Attempts", value: `${backgroundTask.attempt_count}/${backgroundTask.max_attempts}` },
                { label: "Backoff", value: `${backgroundTask.retry_backoff_seconds} seconds` },
                { label: "Available", value: formatDateTime(backgroundTask.available_at) },
                { label: "Started", value: formatDateTime(backgroundTask.started_at) },
                { label: "Completed", value: formatDateTime(backgroundTask.completed_at) },
                { label: "Locked by", value: backgroundTask.locked_by || "--" },
                { label: "Last error", value: backgroundTask.last_error || "--" },
              ]}
            />
          </DetailCard>
          <DetailCard description="Input and result JSON captured for this background task." title="Task payloads">
            <Stack spacing={2}>
              <JsonBlock value={backgroundTask.payload} />
              <JsonBlock emptyMessage="{}" value={backgroundTask.result_summary} />
            </Stack>
          </DetailCard>
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
            subtitle="Automation alerts raised directly against this background task."
            title="Related alerts"
          />
        </>
      )}
    </Stack>
  );
}
