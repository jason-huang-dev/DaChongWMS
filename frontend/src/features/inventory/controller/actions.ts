import { apiPost } from "@/lib/http";
import { reportingApi } from "@/features/reporting/model/api";
import {
  fetchInventoryInformationImportTemplate,
  inventoryApi,
  uploadInventoryInformationWorkbook,
} from "@/features/inventory/model/api";
import { mapInventoryInformationImportResult } from "@/features/inventory/model/inventory-information";
import type {
  InventoryAdjustmentValues,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  OperationalReportExportRecord,
} from "@/features/inventory/model/types";

function buildAdjustmentPayload(
  values: InventoryAdjustmentValues,
  balance: InventoryBalanceRecord,
) {
  return {
    warehouse: balance.warehouse,
    goods: balance.goods,
    from_location: values.movement_type === "ADJUSTMENT_OUT" ? balance.location : null,
    to_location: values.movement_type === "ADJUSTMENT_IN" ? balance.location : null,
    movement_type: values.movement_type,
    stock_status: balance.stock_status,
    lot_number: balance.lot_number,
    serial_number: balance.serial_number,
    quantity: values.quantity,
    unit_cost: Number(balance.unit_cost),
    reference_code: values.reference_code,
    reason: values.reason,
  };
}

export function runInventoryAdjustmentCreate(
  values: InventoryAdjustmentValues,
  balancesById: Map<number, InventoryBalanceRecord>,
) {
  const balance = balancesById.get(values.balance_id);
  if (!balance) {
    throw new Error("The selected inventory position is no longer available.");
  }

  return apiPost<InventoryMovementRecord>(
    inventoryApi.movements,
    buildAdjustmentPayload(values, balance),
  );
}

export function runInventoryAgingReportCreate(warehouseId: number | null) {
  return apiPost<OperationalReportExportRecord>(reportingApi.reportExports, {
    report_type: "INVENTORY_AGING",
    warehouse: warehouseId,
  });
}

export async function runInventoryInformationTemplateDownload(organizationId: number) {
  const blob = await fetchInventoryInformationImportTemplate(organizationId);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "inventory-information-template.xlsx";
  link.click();
  URL.revokeObjectURL(url);
}

export async function runInventoryInformationWorkbookUpload(
  organizationId: number,
  file: File,
  warehouseId?: number | null,
) {
  const response = await uploadInventoryInformationWorkbook(organizationId, file, warehouseId);

  return mapInventoryInformationImportResult(response);
}
