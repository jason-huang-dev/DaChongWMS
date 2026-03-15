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
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { useShipmentReferenceOptions, useWarehouseReferenceOptions, useWebhookReferenceOptions } from "@/shared/hooks/use-reference-options";

export function IntegrationsPage() {
  const {
    carrierBookingsQuery,
    completeJobMutation,
    createCarrierBookingMutation,
    createJobMutation,
    createWebhookMutation,
    defaultCarrierBookingCreateValues,
    defaultIntegrationJobCreateValues,
    defaultWebhookEventCreateValues,
    errorMessage,
    failJobMutation,
    generateLabelMutation,
    jobsQuery,
    logsQuery,
    processWebhookMutation,
    startJobMutation,
    successMessage,
    webhooksQuery,
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
      </Grid>
      <IntegrationTable
        carrierBookingsQuery={carrierBookingsQuery}
        completeJob={(jobId) => completeJobMutation.mutate(jobId)}
        failJob={(jobId) => failJobMutation.mutate(jobId)}
        generateLabel={(bookingId) => generateLabelMutation.mutate(bookingId)}
        isCompletingJob={completeJobMutation.isPending}
        isFailingJob={failJobMutation.isPending}
        isGeneratingLabel={generateLabelMutation.isPending}
        isProcessingWebhook={processWebhookMutation.isPending}
        isStartingJob={startJobMutation.isPending}
        jobsQuery={jobsQuery}
        logsQuery={logsQuery}
        processWebhook={(webhookId) => processWebhookMutation.mutate(webhookId)}
        startJob={(jobId) => startJobMutation.mutate(jobId)}
        webhooksQuery={webhooksQuery}
      />
    </Stack>
  );
}
