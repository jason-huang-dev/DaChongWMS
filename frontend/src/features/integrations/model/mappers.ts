import { parseJsonObject, safeJsonStringify } from "@/shared/utils/json";

import type {
  CarrierBookingCreatePayload,
  CarrierBookingCreateValues,
  IntegrationJobCreatePayload,
  IntegrationJobCreateValues,
  WebhookEventCreatePayload,
  WebhookEventCreateValues,
} from "./types";

export const integrationSystemOptions = [
  { value: "ERP", label: "ERP" },
  { value: "CARRIER", label: "Carrier" },
  { value: "WEBHOOK", label: "Webhook" },
] as const;

export const integrationDirectionOptions = [
  { value: "IMPORT", label: "Import" },
  { value: "EXPORT", label: "Export" },
] as const;

export const integrationJobTypeOptions = [
  { value: "ERP_SYNC", label: "ERP sync" },
  { value: "STOCK_EXPORT", label: "Stock export" },
  { value: "SHIPMENT_EXPORT", label: "Shipment export" },
  { value: "CARRIER_BOOKING", label: "Carrier booking" },
  { value: "LABEL_GENERATION", label: "Label generation" },
  { value: "WEBHOOK_PROCESSING", label: "Webhook processing" },
] as const;

export const defaultIntegrationJobCreateValues: IntegrationJobCreateValues = {
  warehouse: undefined,
  source_webhook: undefined,
  system_type: "ERP",
  integration_name: "",
  job_type: "ERP_SYNC",
  direction: "IMPORT",
  reference_code: "",
  external_reference: "",
  request_payload_json: safeJsonStringify({}),
};

export const defaultWebhookEventCreateValues: WebhookEventCreateValues = {
  warehouse: undefined,
  system_type: "WEBHOOK",
  source_system: "",
  event_type: "",
  event_key: "",
  signature: "",
  headers_json: safeJsonStringify({}),
  payload_json: safeJsonStringify({}),
  reference_code: "",
};

export const defaultCarrierBookingCreateValues: CarrierBookingCreateValues = {
  warehouse: 0,
  shipment: undefined,
  booking_number: "",
  carrier_code: "",
  service_level: "",
  package_count: 1,
  total_weight: "",
  external_reference: "",
  request_payload_json: safeJsonStringify({}),
};

export function mapIntegrationJobCreateValuesToPayload(
  values: IntegrationJobCreateValues,
): IntegrationJobCreatePayload {
  return {
    warehouse: values.warehouse,
    source_webhook: values.source_webhook,
    system_type: values.system_type,
    integration_name: values.integration_name,
    job_type: values.job_type,
    direction: values.direction,
    reference_code: values.reference_code,
    external_reference: values.external_reference,
    request_payload: parseJsonObject(values.request_payload_json, "Request payload"),
  };
}

export function mapWebhookEventCreateValuesToPayload(
  values: WebhookEventCreateValues,
): WebhookEventCreatePayload {
  return {
    warehouse: values.warehouse,
    system_type: values.system_type,
    source_system: values.source_system,
    event_type: values.event_type,
    event_key: values.event_key,
    signature: values.signature,
    headers: parseJsonObject(values.headers_json, "Headers"),
    payload: parseJsonObject(values.payload_json, "Payload"),
    reference_code: values.reference_code,
  };
}

export function mapCarrierBookingCreateValuesToPayload(
  values: CarrierBookingCreateValues,
): CarrierBookingCreatePayload {
  return {
    warehouse: values.warehouse,
    shipment: values.shipment,
    booking_number: values.booking_number,
    carrier_code: values.carrier_code,
    service_level: values.service_level,
    package_count: values.package_count,
    total_weight: values.total_weight || undefined,
    external_reference: values.external_reference,
    request_payload: parseJsonObject(values.request_payload_json, "Request payload"),
  };
}
