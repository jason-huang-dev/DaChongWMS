import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  runCarrierBookingCreate,
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
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateIntegrationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["integrations"], ["automation"], ["dashboard"]]);
}

export function useIntegrationsController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const jobsQuery = usePaginatedResource<IntegrationJobRecord>(["integrations", "jobs"], integrationsApi.jobs, 1, 8);
  const webhooksQuery = usePaginatedResource<WebhookEventRecord>(["integrations", "webhooks"], integrationsApi.webhooks, 1, 8);
  const carrierBookingsQuery = usePaginatedResource<CarrierBookingRecord>(
    ["integrations", "carrier-bookings"],
    integrationsApi.carrierBookings,
    1,
    8,
  );
  const logsQuery = usePaginatedResource<IntegrationLogRecord>(["integrations", "logs"], integrationsApi.logs, 1, 8);

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

  return {
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
