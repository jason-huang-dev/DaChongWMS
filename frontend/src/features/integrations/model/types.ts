import type {
  CarrierBookingRecord,
  IntegrationJobRecord,
  IntegrationLogRecord,
  ShipmentRecord,
  WebhookEventRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type {
  carrierBookingCreateSchema,
  integrationJobCreateSchema,
  webhookEventCreateSchema,
} from "./validators";

export type {
  CarrierBookingRecord,
  IntegrationJobRecord,
  IntegrationLogRecord,
  ShipmentRecord,
  WebhookEventRecord,
};

export type IntegrationJobCreateValues = z.infer<typeof integrationJobCreateSchema>;
export type WebhookEventCreateValues = z.infer<typeof webhookEventCreateSchema>;
export type CarrierBookingCreateValues = z.infer<typeof carrierBookingCreateSchema>;

export interface IntegrationJobCreatePayload {
  warehouse?: number;
  source_webhook?: number;
  system_type: string;
  integration_name: string;
  job_type: string;
  direction: string;
  reference_code: string;
  external_reference: string;
  request_payload: Record<string, unknown>;
}

export interface WebhookEventCreatePayload {
  warehouse?: number;
  system_type: string;
  source_system: string;
  event_type: string;
  event_key: string;
  signature: string;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  reference_code: string;
}

export interface CarrierBookingCreatePayload {
  warehouse: number;
  shipment?: number;
  booking_number: string;
  carrier_code: string;
  service_level: string;
  package_count: number;
  total_weight?: string;
  external_reference: string;
  request_payload: Record<string, unknown>;
}
