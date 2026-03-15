import { Alert, Button, Grid, Stack } from "@mui/material";
import { Link as RouterLink, Navigate, useParams } from "react-router-dom";

import { useWebhookEventDetailController } from "@/features/integrations/controller/useIntegrationsController";
import { DetailCard } from "@/shared/components/detail-card";
import { DetailGrid } from "@/shared/components/detail-grid";
import { JsonBlock } from "@/shared/components/json-block";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { ResourceTable } from "@/shared/components/resource-table";
import { RouteFallback } from "@/shared/components/route-fallback";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function WebhookEventDetailPage() {
  const { webhookId } = useParams<{ webhookId: string }>();
  const { errorMessage, logsQuery, processMutation, successMessage, webhookQuery } =
    useWebhookEventDetailController(webhookId);

  if (!webhookId) {
    return <Navigate replace to="/integrations" />;
  }

  if (webhookQuery.isLoading) {
    return <RouteFallback />;
  }

  const webhook = webhookQuery.data;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Stack direction="row" spacing={1.5}>
            <Button
              disabled={processMutation.isPending || !["RECEIVED", "QUEUED", "FAILED"].includes(webhook?.status ?? "")}
              onClick={() => processMutation.mutate()}
              variant="contained"
            >
              {processMutation.isPending ? "Processing..." : "Process webhook"}
            </Button>
            <Button component={RouterLink} to="/integrations" variant="outlined">
              Back to integrations
            </Button>
          </Stack>
        }
        description="Inspect inbound webhook content, processing state, and emitted logs for a single event."
        title="Webhook event detail"
      />
      <QueryAlert message={webhookQuery.error ? parseApiError(webhookQuery.error) : null} />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      {!webhook ? null : (
        <>
          <DetailCard description="Webhook metadata and processing state." title="Webhook summary">
            <DetailGrid
              items={[
                { label: "Event key", value: webhook.event_key },
                { label: "Source", value: webhook.source_system },
                { label: "Event type", value: webhook.event_type },
                { label: "System", value: webhook.system_type },
                { label: "Status", value: <StatusChip status={webhook.status} /> },
                { label: "Warehouse", value: webhook.warehouse ?? "--" },
                { label: "Reference", value: webhook.reference_code || "--" },
                { label: "Signature", value: webhook.signature || "--" },
                { label: "Received", value: formatDateTime(webhook.received_at) },
                { label: "Processed", value: formatDateTime(webhook.processed_at) },
                { label: "Last error", value: webhook.last_error || "--" },
              ]}
            />
          </DetailCard>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Captured webhook headers." title="Headers">
                <JsonBlock value={webhook.headers} />
              </DetailCard>
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <DetailCard description="Captured webhook payload." title="Payload">
                <JsonBlock value={webhook.payload} />
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
            subtitle="Integration logs emitted while handling this webhook."
            title="Webhook logs"
          />
        </>
      )}
    </Stack>
  );
}
