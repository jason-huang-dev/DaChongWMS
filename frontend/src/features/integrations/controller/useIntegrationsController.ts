import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useTenantScope } from "@/app/scope-context";
import {
  runCarrierBookingCancel,
  runCarrierBookingCreate,
  runCarrierBookingRebook,
  runCarrierBookingRetry,
  runCarrierLabelGenerate,
  runIntegrationJobComplete,
  runIntegrationJobCreate,
  runIntegrationJobFail,
  runIntegrationJobStart,
  runWebhookEventCreate,
  runWebhookEventProcess,
} from "@/features/integrations/controller/actions";
import {
  defaultCarrierBookingCreateValues,
  defaultIntegrationJobCreateValues,
  defaultWebhookEventCreateValues,
} from "@/features/integrations/model/mappers";
import { integrationsApi } from "@/features/integrations/model/api";
import type {
  CarrierBookingCreateValues,
  CarrierBookingRecord,
  IntegrationJobCreateValues,
  IntegrationJobRecord,
  IntegrationLogRecord,
  WebhookEventCreateValues,
  WebhookEventRecord,
} from "@/features/integrations/model/types";
import { useBulkSelection } from "@/shared/hooks/use-bulk-selection";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { executeBulkAction } from "@/shared/lib/bulk-actions";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateIntegrationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["integrations"], ["automation"], ["dashboard"]]);
}

export function useIntegrationsController() {
  const queryClient = useQueryClient();
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const jobSelection = useBulkSelection<number>();
  const webhookSelection = useBulkSelection<number>();
  const carrierBookingSelection = useBulkSelection<number>();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const jobsView = useDataView({
    viewKey: `integrations.jobs.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      integration_name__icontains: "",
      job_type: "",
      status: "",
    },
    pageSize: 8,
  });
  const webhooksView = useDataView({
    viewKey: `integrations.webhooks.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      event_key__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const carrierBookingsView = useDataView({
    viewKey: `integrations.carrier-bookings.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      carrier_code__icontains: "",
      tracking_number__icontains: "",
      status: "",
    },
    pageSize: 8,
  });
  const logsView = useDataView({
    viewKey: `integrations.logs.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      level: "",
    },
    pageSize: 8,
  });

  const jobsQuery = usePaginatedResource<IntegrationJobRecord>(
    ["integrations", "jobs"],
    integrationsApi.jobs,
    jobsView.page,
    jobsView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...jobsView.queryFilters,
    },
  );
  const webhooksQuery = usePaginatedResource<WebhookEventRecord>(
    ["integrations", "webhooks"],
    integrationsApi.webhooks,
    webhooksView.page,
    webhooksView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...webhooksView.queryFilters,
    },
  );
  const carrierBookingsQuery = usePaginatedResource<CarrierBookingRecord>(
    ["integrations", "carrier-bookings"],
    integrationsApi.carrierBookings,
    carrierBookingsView.page,
    carrierBookingsView.pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...carrierBookingsView.queryFilters,
    },
  );
  const logsQuery = usePaginatedResource<IntegrationLogRecord>(
    ["integrations", "logs"],
    integrationsApi.logs,
    logsView.page,
    logsView.pageSize,
    {
      ...logsView.queryFilters,
    },
  );
  const failedJobsQuery = usePaginatedResource<IntegrationJobRecord>(
    ["integrations", "jobs", "failed"],
    integrationsApi.jobs,
    1,
    5,
    {
      warehouse: activeWarehouseId ?? undefined,
      status: "FAILED",
    },
  );
  const failedWebhooksQuery = usePaginatedResource<WebhookEventRecord>(
    ["integrations", "webhooks", "failed"],
    integrationsApi.webhooks,
    1,
    5,
    {
      warehouse: activeWarehouseId ?? undefined,
      status: "FAILED",
    },
  );
  const failedCarrierBookingsQuery = usePaginatedResource<CarrierBookingRecord>(
    ["integrations", "carrier-bookings", "failed"],
    integrationsApi.carrierBookings,
    1,
    5,
    {
      warehouse: activeWarehouseId ?? undefined,
      status: "FAILED",
    },
  );

  const createJobMutation = useMutation({
    mutationFn: (values: IntegrationJobCreateValues) => runIntegrationJobCreate(values),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} created.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const createWebhookMutation = useMutation({
    mutationFn: (values: WebhookEventCreateValues) => runWebhookEventCreate(values),
    onSuccess: async (webhook) => {
      setErrorMessage(null);
      setSuccessMessage(`Webhook ${webhook.event_key} accepted.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const createCarrierBookingMutation = useMutation({
    mutationFn: (values: CarrierBookingCreateValues) => runCarrierBookingCreate(values),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Carrier booking ${booking.booking_number} created.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const startJobMutation = useMutation({
    mutationFn: (jobId: number) => runIntegrationJobStart(jobId),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} started.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const completeJobMutation = useMutation({
    mutationFn: (jobId: number) => runIntegrationJobComplete(jobId),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} completed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const failJobMutation = useMutation({
    mutationFn: (jobId: number) => runIntegrationJobFail(jobId),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} failed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const processWebhookMutation = useMutation({
    mutationFn: (webhookId: number) => runWebhookEventProcess(webhookId),
    onSuccess: async (webhook) => {
      setErrorMessage(null);
      setSuccessMessage(`Webhook ${webhook.event_key} processed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const generateLabelMutation = useMutation({
    mutationFn: (bookingId: number) => runCarrierLabelGenerate(bookingId),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Label generated for booking ${booking.booking_number}.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const retryCarrierBookingMutation = useMutation({
    mutationFn: (bookingId: number) => runCarrierBookingRetry(bookingId),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Carrier booking ${booking.booking_number} requeued for recovery.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const rebookCarrierBookingMutation = useMutation({
    mutationFn: (bookingId: number) => runCarrierBookingRebook(bookingId),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Carrier booking ${booking.booking_number} rebooked.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });
  const cancelCarrierBookingMutation = useMutation({
    mutationFn: (bookingId: number) => runCarrierBookingCancel(bookingId),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Carrier booking ${booking.booking_number} cancelled.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const bulkStartJobsMutation = useMutation({
    mutationFn: (jobIds: number[]) =>
      executeBulkAction(jobIds, (jobId) => runIntegrationJobStart(jobId)),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.successCount > 0
          ? `Retried or started ${result.successCount} integration job${result.successCount === 1 ? "" : "s"}.`
          : null,
      );
      setErrorMessage(
        result.failures.length > 0
          ? `Failed ${result.failures.length} integration job${result.failures.length === 1 ? "" : "s"}: ${result.failures
              .slice(0, 3)
              .map((failure) => `#${failure.item} ${failure.message}`)
              .join("; ")}`
          : null,
      );
      jobSelection.clearSelection();
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const bulkProcessWebhookMutation = useMutation({
    mutationFn: (webhookIds: number[]) =>
      executeBulkAction(webhookIds, (webhookId) => runWebhookEventProcess(webhookId)),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.successCount > 0
          ? `Processed ${result.successCount} webhook${result.successCount === 1 ? "" : "s"}.`
          : null,
      );
      setErrorMessage(
        result.failures.length > 0
          ? `Failed ${result.failures.length} webhook${result.failures.length === 1 ? "" : "s"}: ${result.failures
              .slice(0, 3)
              .map((failure) => `#${failure.item} ${failure.message}`)
              .join("; ")}`
          : null,
      );
      webhookSelection.clearSelection();
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const bulkRetryCarrierBookingMutation = useMutation({
    mutationFn: (bookingIds: number[]) => executeBulkAction(bookingIds, (bookingId) => runCarrierBookingRetry(bookingId)),
    onSuccess: async (result) => {
      setSuccessMessage(
        result.successCount > 0
          ? `Retried ${result.successCount} carrier booking${result.successCount === 1 ? "" : "s"}.`
          : null,
      );
      setErrorMessage(
        result.failures.length > 0
          ? `Failed ${result.failures.length} carrier booking${result.failures.length === 1 ? "" : "s"}: ${result.failures
              .slice(0, 3)
              .map((failure) => `#${failure.item} ${failure.message}`)
              .join("; ")}`
          : null,
      );
      carrierBookingSelection.clearSelection();
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    activeWarehouse,
    bulkRetryCarrierBookingMutation,
    bulkProcessWebhookMutation,
    bulkStartJobsMutation,
    carrierBookingSelection,
    carrierBookingsQuery,
    carrierBookingsView,
    completeJobMutation,
    createCarrierBookingMutation,
    createJobMutation,
    createWebhookMutation,
    cancelCarrierBookingMutation,
    defaultCarrierBookingCreateValues,
    defaultIntegrationJobCreateValues,
    defaultWebhookEventCreateValues,
    errorMessage,
    failJobMutation,
    failedCarrierBookingsQuery,
    failedJobsQuery,
    failedWebhooksQuery,
    generateLabelMutation,
    jobSelection,
    jobsQuery,
    jobsView,
    logsQuery,
    logsView,
    processWebhookMutation,
    rebookCarrierBookingMutation,
    retryCarrierBookingMutation,
    startJobMutation,
    successMessage,
    webhookSelection,
    webhooksQuery,
    webhooksView,
  };
}

export function useIntegrationJobDetailController(jobId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const jobQuery = useResource<IntegrationJobRecord>(
    ["integrations", "jobs", jobId],
    `${integrationsApi.jobs}${jobId}/`,
    undefined,
    { enabled: Boolean(jobId) },
  );
  const logsQuery = usePaginatedResource<IntegrationLogRecord>(
    ["integrations", "logs", "job", jobId],
    integrationsApi.logs,
    1,
    8,
    jobId ? { job: jobId } : undefined,
    { enabled: Boolean(jobId) },
  );

  const startMutation = useMutation({
    mutationFn: () => runIntegrationJobStart(Number(jobId)),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} started.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const completeMutation = useMutation({
    mutationFn: () => runIntegrationJobComplete(Number(jobId)),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} completed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const failMutation = useMutation({
    mutationFn: () => runIntegrationJobFail(Number(jobId)),
    onSuccess: async (job) => {
      setErrorMessage(null);
      setSuccessMessage(`Integration job ${job.reference_code || job.id} failed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    completeMutation,
    errorMessage,
    failMutation,
    jobQuery,
    logsQuery,
    startMutation,
    successMessage,
  };
}

export function useWebhookEventDetailController(webhookId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const webhookQuery = useResource<WebhookEventRecord>(
    ["integrations", "webhooks", webhookId],
    `${integrationsApi.webhooks}${webhookId}/`,
    undefined,
    { enabled: Boolean(webhookId) },
  );
  const logsQuery = usePaginatedResource<IntegrationLogRecord>(
    ["integrations", "logs", "webhook", webhookId],
    integrationsApi.logs,
    1,
    8,
    webhookId ? { webhook_event: webhookId } : undefined,
    { enabled: Boolean(webhookId) },
  );

  const processMutation = useMutation({
    mutationFn: () => runWebhookEventProcess(Number(webhookId)),
    onSuccess: async (webhook) => {
      setErrorMessage(null);
      setSuccessMessage(`Webhook ${webhook.event_key} processed.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    errorMessage,
    logsQuery,
    processMutation,
    successMessage,
    webhookQuery,
  };
}

export function useCarrierBookingDetailController(carrierBookingId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const carrierBookingQuery = useResource<CarrierBookingRecord>(
    ["integrations", "carrier-bookings", carrierBookingId],
    `${integrationsApi.carrierBookings}${carrierBookingId}/`,
    undefined,
    { enabled: Boolean(carrierBookingId) },
  );

  const generateLabelMutation = useMutation({
    mutationFn: () => runCarrierLabelGenerate(Number(carrierBookingId)),
    onSuccess: async (booking) => {
      setErrorMessage(null);
      setSuccessMessage(`Label generated for booking ${booking.booking_number}.`);
      await invalidateIntegrationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    carrierBookingQuery,
    errorMessage,
    generateLabelMutation,
    successMessage,
  };
}
