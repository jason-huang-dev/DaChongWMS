import { apiDelete, apiPatch, apiPost } from "@/lib/http";

import type {
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderCreatePayload,
  TransferOrderRecord,
  TransferOrderUpdatePayload,
} from "./types";

export const transfersApi = {
  replenishmentRules: "/api/transfers/replenishment-rules/",
  replenishmentTasks: "/api/transfers/replenishment-tasks/",
  transferLines: "/api/transfers/transfer-lines/",
  transferOrders: "/api/transfers/transfer-orders/",
} as const;

export function createTransferOrder(values: TransferOrderCreatePayload) {
  return apiPost<TransferOrderRecord>(transfersApi.transferOrders, values);
}

export function updateTransferOrder(
  transferOrderId: string,
  values: TransferOrderUpdatePayload,
) {
  return apiPatch<TransferOrderRecord>(
    `${transfersApi.transferOrders}${transferOrderId}/`,
    values,
  );
}

export function archiveTransferOrder(transferOrderId: string) {
  return apiDelete<TransferOrderRecord>(
    `${transfersApi.transferOrders}${transferOrderId}/`,
  );
}

export function completeTransferLine(transferLineId: number) {
  return apiPost<TransferLineRecord>(
    `${transfersApi.transferLines}${transferLineId}/complete/`,
    {},
  );
}

export function generateReplenishmentTask(replenishmentRuleId: number) {
  return apiPost<ReplenishmentTaskRecord>(
    `${transfersApi.replenishmentRules}${replenishmentRuleId}/generate-task/`,
    {},
  );
}

export function completeReplenishmentTask(replenishmentTaskId: number) {
  return apiPost<ReplenishmentTaskRecord>(
    `${transfersApi.replenishmentTasks}${replenishmentTaskId}/complete/`,
    {},
  );
}

export function updateTransferLine(transferLineId: number, values: Partial<TransferLineRecord>) {
  return apiPatch<TransferLineRecord>(
    `${transfersApi.transferLines}${transferLineId}/`,
    values,
  );
}

export function updateReplenishmentTask(
  replenishmentTaskId: number,
  values: Partial<ReplenishmentTaskRecord>,
) {
  return apiPatch<ReplenishmentTaskRecord>(
    `${transfersApi.replenishmentTasks}${replenishmentTaskId}/`,
    values,
  );
}

export function updateReplenishmentRule(
  replenishmentRuleId: number,
  values: Partial<ReplenishmentRuleRecord>,
) {
  return apiPatch<ReplenishmentRuleRecord>(
    `${transfersApi.replenishmentRules}${replenishmentRuleId}/`,
    values,
  );
}
