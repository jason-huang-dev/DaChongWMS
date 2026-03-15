import { zodResolver } from "@hookform/resolvers/zod";
import Grid from "@mui/material/Grid";
import { Alert, Stack } from "@mui/material";
import { useForm } from "react-hook-form";

import { useIntegrationsController } from "@/features/integrations/controller/useIntegrationsController";
import type {
  CarrierBookingCreateValues,
  IntegrationJobCreateValues,
  WebhookEventCreateValues,
} from "@/features/integrations/model/types";
import {
  carrierBookingCreateSchema,
  integrationJobCreateSchema,
  webhookEventCreateSchema,
} from "@/features/integrations/model/validators";
import { IntegrationForm } from "@/features/integrations/view/IntegrationForm";
import { IntegrationTable } from "@/features/integrations/view/IntegrationTable";
import { CarrierBookingForm } from "@/features/integrations/view/components/CarrierBookingForm";
import { WebhookEventForm } from "@/features/integrations/view/components/WebhookEventForm";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { RecordLink } from "@/shared/components/record-link";
import { StatusChip } from "@/shared/components/status-chip";
import { useShipmentReferenceOptions, useWarehouseReferenceOptions, useWebhookReferenceOptions } from "@/shared/hooks/use-reference-options";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function IntegrationsPage() {
  const {
    activeWarehouse,
    carrierBookingsQuery,
    carrierBookingsView,
    completeJobMutation,
    createCarrierBookingMutation,
    createJobMutation,
    createWebhookMutation,
    defaultCarrierBookingCreateValues,
    defaultIntegrationJobCreateValues,
    defaultWebhookEventCreateValues,
    errorMessage,
    failJobMutation,
    failedCarrierBookingsQuery,
    failedJobsQuery,
    failedWebhooksQuery,
    generateLabelMutation,
    jobsQuery,
    jobsView,
    logsQuery,
    logsView,
    processWebhookMutation,
    startJobMutation,
    successMessage,
    webhooksQuery,
    webhooksView,
  } = useIntegrationsController();
  const warehouses = useWarehouseReferenceOptions();
  const sourceWebhooks = useWebhookReferenceOptions();
  const shipments = useShipmentReferenceOptions();

  const integrationJobForm = useForm<IntegrationJobCreateValues>({
    defaultValues: defaultIntegrationJobCreateValues,
    resolver: zodResolver(integrationJobCreateSchema),
  });
  const webhookForm = useForm<WebhookEventCreateValues>({
    defaultValues: defaultWebhookEventCreateValues,
    resolver: zodResolver(webhookEventCreateSchema),
  });
  const carrierBookingForm = useForm<CarrierBookingCreateValues>({
    defaultValues: defaultCarrierBookingCreateValues,
    resolver: zodResolver(carrierBookingCreateSchema),
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Operator and admin surface for integration job creation, webhook intake, carrier booking, and execution monitoring."
        title="Integrations"
      />
      <QueryAlert message={errorMessage} />
      {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 6 }}>
          <IntegrationForm
            errorMessage={errorMessage}
            form={integrationJobForm}
            isPending={createJobMutation.isPending}
            onSubmit={(values) => createJobMutation.mutate(values)}
            sourceWebhookReference={sourceWebhooks}
            successMessage={successMessage}
            warehouseReference={warehouses}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <WebhookEventForm
            form={webhookForm}
            isPending={createWebhookMutation.isPending}
            onSubmit={(values) => createWebhookMutation.mutate(values)}
            warehouseReference={warehouses}
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <CarrierBookingForm
            form={carrierBookingForm}
            isPending={createCarrierBookingMutation.isPending}
            onSubmit={(values) => createCarrierBookingMutation.mutate(values)}
            shipmentReference={shipments}
            warehouseReference={warehouses}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ExceptionLane
            columns={[
              {
                header: "Job",
                key: "job",
                render: (row) => (
                  <RecordLink to={`/integrations/jobs/${row.id}`}>
                    {row.reference_code || `${row.integration_name} #${row.id}`}
                  </RecordLink>
                ),
              },
              { header: "Type", key: "type", render: (row) => row.job_type },
              { header: "Updated", key: "updated", render: (row) => formatDateTime(row.update_time) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            emptyMessage="No failed integration jobs."
            error={failedJobsQuery.error ? parseApiError(failedJobsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={failedJobsQuery.isLoading}
            rows={failedJobsQuery.data?.results ?? []}
            severity="error"
            subtitle="Manual or scheduled ERP/carrier jobs that stopped and need operator follow-up."
            title="Failed integrations: jobs"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ExceptionLane
            columns={[
              {
                header: "Webhook",
                key: "webhook",
                render: (row) => <RecordLink to={`/integrations/webhooks/${row.id}`}>{row.event_key}</RecordLink>,
              },
              { header: "Source", key: "source", render: (row) => row.source_system },
              { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            emptyMessage="No failed webhook events."
            error={failedWebhooksQuery.error ? parseApiError(failedWebhooksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={failedWebhooksQuery.isLoading}
            rows={failedWebhooksQuery.data?.results ?? []}
            severity="error"
            subtitle="Webhook payloads that could not be processed successfully."
            title="Failed integrations: webhooks"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ExceptionLane
            columns={[
              {
                header: "Booking",
                key: "booking",
                render: (row) => (
                  <RecordLink to={`/integrations/carrier-bookings/${row.id}`}>{row.booking_number}</RecordLink>
                ),
              },
              { header: "Carrier", key: "carrier", render: (row) => row.carrier_code },
              { header: "Tracking", key: "tracking", render: (row) => row.tracking_number || "--" },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            emptyMessage="No failed carrier bookings."
            error={failedCarrierBookingsQuery.error ? parseApiError(failedCarrierBookingsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={failedCarrierBookingsQuery.isLoading}
            rows={failedCarrierBookingsQuery.data?.results ?? []}
            severity="error"
            subtitle="Carrier booking or label requests that need a retry or manual escalation."
            title="Failed integrations: carrier"
          />
        </Grid>
      </Grid>
      <IntegrationTable
        activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
        carrierBookingsQuery={carrierBookingsQuery}
        carrierBookingsView={carrierBookingsView}
        completeJob={(jobId) => completeJobMutation.mutate(jobId)}
        failJob={(jobId) => failJobMutation.mutate(jobId)}
        generateLabel={(bookingId) => generateLabelMutation.mutate(bookingId)}
        isCompletingJob={completeJobMutation.isPending}
        isFailingJob={failJobMutation.isPending}
        isGeneratingLabel={generateLabelMutation.isPending}
        isProcessingWebhook={processWebhookMutation.isPending}
        isStartingJob={startJobMutation.isPending}
        jobsQuery={jobsQuery}
        jobsView={jobsView}
        logsQuery={logsQuery}
        logsView={logsView}
        processWebhook={(webhookId) => processWebhookMutation.mutate(webhookId)}
        startJob={(jobId) => startJobMutation.mutate(jobId)}
        webhooksQuery={webhooksQuery}
        webhooksView={webhooksView}
      />
    </Stack>
  );
}
