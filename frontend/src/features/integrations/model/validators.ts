import { z } from "zod";

import { parseJsonObject } from "@/shared/utils/json";

const optionalPositiveNumber = z.preprocess(
  (value) => (value === "" || value === null || value === undefined || value === 0 ? undefined : value),
  z.coerce.number().int().positive().optional(),
);

function validateJsonObjectField(value: string, fieldName: string) {
  try {
    parseJsonObject(value, fieldName);
    return true;
  } catch {
    return false;
  }
}

export const integrationJobCreateSchema = z.object({
  warehouse: optionalPositiveNumber,
  source_webhook: optionalPositiveNumber,
  system_type: z.string().trim().min(1, "System type is required"),
  integration_name: z.string().trim().min(1, "Integration name is required"),
  job_type: z.string().trim().min(1, "Job type is required"),
  direction: z.string().trim().min(1, "Direction is required"),
  reference_code: z.string().trim().optional().default(""),
  external_reference: z.string().trim().optional().default(""),
  request_payload_json: z.string().trim().default("{}").refine(
    (value) => validateJsonObjectField(value, "Request payload"),
    "Request payload must be valid JSON object",
  ),
});

export const webhookEventCreateSchema = z.object({
  warehouse: optionalPositiveNumber,
  system_type: z.string().trim().min(1, "System type is required"),
  source_system: z.string().trim().min(1, "Source system is required"),
  event_type: z.string().trim().min(1, "Event type is required"),
  event_key: z.string().trim().min(1, "Event key is required"),
  signature: z.string().trim().optional().default(""),
  headers_json: z.string().trim().default("{}").refine(
    (value) => validateJsonObjectField(value, "Headers"),
    "Headers must be valid JSON object",
  ),
  payload_json: z.string().trim().default("{}").refine(
    (value) => validateJsonObjectField(value, "Payload"),
    "Payload must be valid JSON object",
  ),
  reference_code: z.string().trim().optional().default(""),
});

export const carrierBookingCreateSchema = z.object({
  warehouse: z.coerce.number().int().positive("Warehouse is required"),
  shipment: optionalPositiveNumber,
  booking_number: z.string().trim().min(1, "Booking number is required"),
  carrier_code: z.string().trim().min(1, "Carrier code is required"),
  service_level: z.string().trim().optional().default(""),
  package_count: z.coerce.number().int().positive("Package count must be greater than zero"),
  total_weight: z.string().trim().optional().default(""),
  external_reference: z.string().trim().optional().default(""),
  request_payload_json: z.string().trim().default("{}").refine(
    (value) => validateJsonObjectField(value, "Request payload"),
    "Request payload must be valid JSON object",
  ),
});
