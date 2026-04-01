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

export type InventoryInformationSource = "live" | "imported";
export type InventoryInformationAreaKey =
  | "receiving"
  | "storage"
  | "picking"
  | "staging"
  | "defect"
  | "unassigned";

export interface InventoryInformationAreaOption {
  key: InventoryInformationAreaKey;
  label: string;
  count: number;
}

export interface InventoryInformationClient {
  code: string;
  name: string;
  label: string;
}

export type InventoryInformationSortKey =
  | "merchantSku"
  | "merchantCode"
  | "productName"
  | "productBarcode"
  | "warehouseName"
  | "client"
  | "inTransit"
  | "pendingReceival"
  | "toList"
  | "orderAllocated"
  | "availableStock"
  | "defectiveProducts"
  | "totalInventory";

export interface InventoryInformationRow {
  id: string;
  merchantSku: string;
  productName: string;
  productBarcode: string;
  productCategory: string;
  productBrand: string;
  productDescription: string;
  productTags: string[];
  clients: InventoryInformationClient[];
  shelf: string;
  shelves: string[];
  inTransit: number;
  pendingReceival: number;
  toList: number;
  orderAllocated: number;
  availableStock: number;
  defectiveProducts: number;
  totalInventory: number;
  listingTime: string;
  actualLength: string;
  actualWidth: string;
  actualHeight: string;
  actualWeight: string;
  measurementUnit: string;
  merchantCode: string;
  customerCode: string;
  warehouseName: string;
  stockStatus: string;
  stockStatuses: string[];
  zoneCode: string;
  zoneCodes: string[];
  locationTypeCode: string;
  locationTypeCodes: string[];
  areaKey: InventoryInformationAreaKey;
  areaLabel: string;
  source: InventoryInformationSource;
}

export interface InventoryInformationImportResult {
  importedRows: InventoryInformationRow[];
  warnings: string[];
  errors: string[];
}

export interface InventoryInformationImportApiRow {
  merchant_sku: string;
  product_name: string;
  shelf: string;
  available_stock: string;
  listing_time: string;
  actual_length: string;
  actual_width: string;
  actual_height: string;
  actual_weight: string;
  measurement_unit: string;
  merchant_code: string;
  customer_code: string;
  warehouse_name: string;
  stock_status: string;
  source: InventoryInformationSource;
}

export type InventoryAdjustmentValues = z.infer<typeof inventoryAdjustmentSchema>;
