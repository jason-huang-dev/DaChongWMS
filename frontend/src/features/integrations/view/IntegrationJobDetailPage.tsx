import { Alert, Button, Grid, Stack } from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useIntegrationJobDetailController } from "@/features/integrations/controller/useIntegrationsController";
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

export function IntegrationJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { completeMutation, errorMessage, failMutation, jobQuery, logsQuery, startMutation, successMessage } =
    useIntegrationJobDetailController(jobId);

  if (!jobId) {
    return <Navigate replace to="/integrations" />;
  }

  if (jobQuery.isLoading) {
    return <RouteFallback />;
  }

  const job = jobQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={startMutation.isPending || job?.status !== "QUEUED"}
              onClick={() => startMutation.mutate()}
              variant="outlined"
            >
              {startMutation.isPending ? "Starting..." : "Start"}
            </Button>
            <Button
              disabled={completeMutation.isPending || job?.status !== "RUNNING"}
              onClick={() => completeMutation.mutate()}
              variant="contained"
            >
              {completeMutation.isPending ? "Completing..." : "Complete"}
            </Button>
            <Button
              disabled={failMutation.isPending || !["QUEUED", "RUNNING"].includes(job?.status ?? "")}
              onClick={() => failMutation.mutate()}
              variant="text"
            >
              {failMutation.isPending ? "Failing..." : "Fail"}
            </Button>
            <Button component={RouterLink} to="/integrations" variant="outlined">
              Back to integrations
            </Button>
          </Stack>
        }
        description="Inspect a single integration job, including request/response payloads and emitted logs."
        title="Integration job detail"
      />
      <QueryAlert message={jobQuery.error ? parseApiError(jobQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!job ? null : (
        <>
          <DetailCard description="Execution state and related references for this integration job." title="Job summary">
            <DetailGrid
              items={[
                { label: "Reference", value: job.reference_code || `${job.integration_name} #${job.id}` },
                { label: "Integration", value: job.integration_name },
                { label: "Job type", value: job.job_type },
                { label: "Direction", value: job.direction },
                { label: "System", value: job.system_type },
                { label: "Status", value: <StatusChip status={job.status} /> },
                { label: "Warehouse", value: job.warehouse ?? "--" },
                {
                  label: "Source webhook",
                  value: job.source_webhook ? (
                    <RecordLink to={`/integrations/webhooks/${job.source_webhook}`}>Webhook {job.source_webhook}</RecordLink>
                  ) : (
                    "--"
                  ),
                },
                { label: "External reference", value: job.external_reference || "--" },
                { label: "Attempts", value: job.attempt_count },
                { label: "Triggered by", value: job.triggered_by || "--" },
                { label: "Started", value: formatDateTime(job.started_at) },
                { label: "Completed", value: formatDateTime(job.completed_at) },
                { label: "Last error", value: job.last_error || "--" },
              ]}
            />
          </DetailCard>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Outbound payload posted to the backend job endpoint." title="Request payload">
                <JsonBlock value={job.request_payload} />
              </DetailCard>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Response payload captured from the backend workflow." title="Response payload">
                <JsonBlock value={job.response_payload} />
              </DetailCard>
            </Grid>
          </Grid>
          <ResourceTable
            columns={[
              { header: "Logged at", key: "loggedAt", render: (row) => formatDateTime(row.logged_at) },
              { header: "Level", key: "level", render: (row) => row.level },
              { header: "Message", key: "message", render: (row) => row.message },
            ]}
            error={logsQuery.error ? parseApiError(logsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={logsQuery.isLoading}
            rows={logsQuery.data?.results ?? []}
            subtitle="Integration logs emitted by this job."
            title="Job logs"
          />
        </>
      )}
    </Stack>
  );
}
