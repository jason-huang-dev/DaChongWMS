import { apiGet, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  CarrierBookingCreatePayload,
  CarrierBookingRecord,
  IntegrationJobCreatePayload,
  IntegrationJobRecord,
  IntegrationLogRecord,
  WebhookEventCreatePayload,
  WebhookEventRecord,
} from "./types";

export const integrationsApi = {
  carrierBookings: "/api/integrations/carrier-bookings/",
  jobs: "/api/integrations/jobs/",
  logs: "/api/integrations/logs/",
  webhooks: "/api/integrations/webhooks/",
} as const;

export function createIntegrationJob(values: IntegrationJobCreatePayload) {
  return apiPost<IntegrationJobRecord>(integrationsApi.jobs, values);
}

export function startIntegrationJob(jobId: number) {
  return apiPost<IntegrationJobRecord>(`${integrationsApi.jobs}${jobId}/start/`, {});
}

export function completeIntegrationJob(jobId: number) {
  return apiPost<IntegrationJobRecord>(`${integrationsApi.jobs}${jobId}/complete/`, { response_payload: {} });
}

export function failIntegrationJob(jobId: number, errorMessage: string) {
  return apiPost<IntegrationJobRecord>(`${integrationsApi.jobs}${jobId}/fail/`, {
    error_message: errorMessage,
    response_payload: {},
  });
}

export function createWebhookEvent(values: WebhookEventCreatePayload) {
  return apiPost<WebhookEventRecord>(integrationsApi.webhooks, values);
}

export function processWebhookEvent(webhookId: number) {
  return apiPost<WebhookEventRecord>(`${integrationsApi.webhooks}${webhookId}/process/`, { response_payload: {} });
}

export function createCarrierBooking(values: CarrierBookingCreatePayload) {
  return apiPost<CarrierBookingRecord>(integrationsApi.carrierBookings, values);
}

export function generateCarrierLabel(bookingId: number, labelFormat: "PDF" | "ZPL" = "PDF") {
  return apiPost<CarrierBookingRecord>(`${integrationsApi.carrierBookings}${bookingId}/generate-label/`, {
    label_format: labelFormat,
  });
}

export function retryCarrierBooking(bookingId: number, labelFormat: "PDF" | "ZPL" = "PDF") {
  return apiPost<CarrierBookingRecord>(`${integrationsApi.carrierBookings}${bookingId}/retry/`, {
    label_format: labelFormat,
  });
}

export function rebookCarrierBooking(bookingId: number) {
  return apiPost<CarrierBookingRecord>(`${integrationsApi.carrierBookings}${bookingId}/rebook/`, {});
}

export function cancelCarrierBooking(bookingId: number, cancelReason = "") {
  return apiPost<CarrierBookingRecord>(`${integrationsApi.carrierBookings}${bookingId}/cancel/`, {
    cancel_reason: cancelReason,
  });
}

export function listIntegrationJobs(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<IntegrationJobRecord>>(integrationsApi.jobs, { page, page_size: pageSize });
}

export function listWebhookEvents(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<WebhookEventRecord>>(integrationsApi.webhooks, { page, page_size: pageSize });
}

export function listCarrierBookings(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<CarrierBookingRecord>>(integrationsApi.carrierBookings, { page, page_size: pageSize });
}

export function listIntegrationLogs(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<IntegrationLogRecord>>(integrationsApi.logs, { page, page_size: pageSize });
}
