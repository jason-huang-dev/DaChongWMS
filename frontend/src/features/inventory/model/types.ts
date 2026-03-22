import type {
  CountApprovalQueueRecord,
  CountingDashboardSummary,
  InventoryAdjustmentApprovalRuleRecord,
  InventoryAdjustmentReasonRecord,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  OperationalReportExportRecord,
  ReplenishmentTaskRecord,
  TransferOrderRecord,
  WarehouseRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { inventoryAdjustmentSchema } from "./validators";

export type {
  CountApprovalQueueRecord,
  CountingDashboardSummary,
  InventoryAdjustmentApprovalRuleRecord,
  InventoryAdjustmentReasonRecord,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  OperationalReportExportRecord,
  ReplenishmentTaskRecord,
  TransferOrderRecord,
  WarehouseRecord,
};

export interface StockAgeBucket {
  label: string;
  count: number;
  quantity: number;
}

export interface StockAgeRow {
  id: number;
  goods_code: string;
  location_code: string;
  warehouse_name: string;
  on_hand_qty: string;
  available_qty: string;
  age_days: number;
  last_activity: string | null;
}

export interface CrossWarehouseTransferCandidate {
  goods_code: string;
  active_warehouse_qty: number;
  other_warehouse_qty: number;
  other_warehouses: string[];
}

export type InventoryAdjustmentValues = z.infer<typeof inventoryAdjustmentSchema>;
