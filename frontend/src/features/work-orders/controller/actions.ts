import { apiPatch, apiPost } from "@/lib/http";

import {
  buildWorkOrderDetailPath,
  buildWorkOrdersPath,
  buildWorkOrderTypeDetailPath,
  buildWorkOrderTypesPath,
} from "@/features/work-orders/model/api";
import type { WorkOrderRecord, WorkOrderTypeRecord } from "@/features/work-orders/model/types";

export function runWorkOrderTypeCreate(
  organizationId: number | string,
  values: Record<string, unknown>,
) {
  return apiPost<WorkOrderTypeRecord>(buildWorkOrderTypesPath(organizationId), values);
}

export function runWorkOrderTypeUpdate(
  organizationId: number | string,
  workOrderTypeId: number,
  values: Record<string, unknown>,
) {
  return apiPatch<WorkOrderTypeRecord>(buildWorkOrderTypeDetailPath(organizationId, workOrderTypeId), values);
}

export function runWorkOrderCreate(
  organizationId: number | string,
  values: Record<string, unknown>,
) {
  return apiPost<WorkOrderRecord>(buildWorkOrdersPath(organizationId), values);
}

export function runWorkOrderUpdate(
  organizationId: number | string,
  workOrderId: number,
  values: Record<string, unknown>,
) {
  return apiPatch<WorkOrderRecord>(buildWorkOrderDetailPath(organizationId, workOrderId), values);
}
