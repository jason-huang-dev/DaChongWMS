import {
  completeIntegrationJob,
  cancelCarrierBooking,
  createCarrierBooking,
  createIntegrationJob,
  createWebhookEvent,
  failIntegrationJob,
  generateCarrierLabel,
  processWebhookEvent,
  rebookCarrierBooking,
  retryCarrierBooking,
  startIntegrationJob,
} from "@/features/integrations/model/api";
import {
  mapCarrierBookingCreateValuesToPayload,
  mapIntegrationJobCreateValuesToPayload,
  mapWebhookEventCreateValuesToPayload,
} from "@/features/integrations/model/mappers";
import type {
  CarrierBookingCreateValues,
  IntegrationJobCreateValues,
  WebhookEventCreateValues,
} from "@/features/integrations/model/types";

export function runIntegrationJobCreate(values: IntegrationJobCreateValues) {
  return createIntegrationJob(mapIntegrationJobCreateValuesToPayload(values));
}

export function runIntegrationJobStart(jobId: number) {
  return startIntegrationJob(jobId);
}

export function runIntegrationJobComplete(jobId: number) {
  return completeIntegrationJob(jobId);
}

export function runIntegrationJobFail(jobId: number) {
  return failIntegrationJob(jobId, "Marked as failed from the operator console");
}

export function runWebhookEventCreate(values: WebhookEventCreateValues) {
  return createWebhookEvent(mapWebhookEventCreateValuesToPayload(values));
}

export function runWebhookEventProcess(webhookId: number) {
  return processWebhookEvent(webhookId);
}

export function runCarrierBookingCreate(values: CarrierBookingCreateValues) {
  return createCarrierBooking(mapCarrierBookingCreateValuesToPayload(values));
}

export function runCarrierLabelGenerate(bookingId: number) {
  return generateCarrierLabel(bookingId, "PDF");
}

export function runCarrierBookingRetry(bookingId: number) {
  return retryCarrierBooking(bookingId, "PDF");
}

export function runCarrierBookingRebook(bookingId: number) {
  return rebookCarrierBooking(bookingId);
}

export function runCarrierBookingCancel(bookingId: number) {
  return cancelCarrierBooking(bookingId, "Cancelled from the operator console");
}
