import {
  archiveTransferOrder,
  completeReplenishmentTask,
  completeTransferLine,
  createTransferOrder,
  generateReplenishmentTask,
  updateTransferOrder,
} from "@/features/transfers/model/api";
import { mapCreateValuesToTransferOrderPayload, mapEditValuesToTransferOrderPayload } from "@/features/transfers/model/mappers";

import type { InventoryBalanceRecord, TransferOrderCreateValues, TransferOrderEditValues } from "@/features/transfers/model/types";

export function runTransferOrderCreate(
  values: TransferOrderCreateValues,
  balancesById: Map<number, InventoryBalanceRecord>,
) {
  return createTransferOrder(mapCreateValuesToTransferOrderPayload(values, balancesById));
}

export function runTransferOrderUpdate(
  transferOrderId: string,
  values: TransferOrderEditValues,
) {
  return updateTransferOrder(
    transferOrderId,
    mapEditValuesToTransferOrderPayload(values),
  );
}

export function runTransferOrderArchive(transferOrderId: string) {
  return archiveTransferOrder(transferOrderId);
}

export function runTransferLineComplete(transferLineId: number) {
  return completeTransferLine(transferLineId);
}

export function runReplenishmentTaskGenerate(replenishmentRuleId: number) {
  return generateReplenishmentTask(replenishmentRuleId);
}

export function runReplenishmentTaskComplete(replenishmentTaskId: number) {
  return completeReplenishmentTask(replenishmentTaskId);
}
