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
import type { PaginatedResponse } from "@/shared/types/api";
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

export type InventoryMovementHistorySortKey =
  | "occurredAt"
  | "merchantSku"
  | "warehouseName"
  | "movementType"
  | "quantity"
  | "resultingQuantity";

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

export interface InventoryMovementHistoryFilterOption {
  value: string;
  label: string;
}

export interface InventoryMovementHistoryDocumentNumber {
  label: string;
  value: string;
}

export interface InventoryMovementHistoryRow {
  id: number;
  warehouseId: number;
  warehouseName: string;
  productId: number;
  merchantSku: string;
  productName: string;
  productBarcode: string;
  clientCode: string;
  clientName: string;
  movementType: string;
  movementTypeLabel: string;
  entryTypeLabel: string;
  stockStatus: string;
  quantity: number;
  fromLocationCode: string;
  toLocationCode: string;
  referenceCode: string;
  sourceDocumentNumber: string;
  linkedDocumentNumbers: InventoryMovementHistoryDocumentNumber[];
  sourceDocumentNumbers: InventoryMovementHistoryDocumentNumber[];
  purchaseOrderNumber: string;
  receiptNumber: string;
  asnNumber: string;
  batchNumber: string;
  serialNumber: string;
  shelfCode: string;
  quantityBeforeChange: number | null;
  remainingBatchQuantity: number | null;
  reason: string;
  performedBy: string;
  occurredAt: string;
  resultingFromQty: number | null;
  resultingToQty: number | null;
  resultingQuantity: number | null;
  resultingLocationCode: string;
}

export interface InventoryMovementHistoryListResponse extends PaginatedResponse<InventoryMovementHistoryRow> {
  filterOptions: {
    warehouses: InventoryMovementHistoryFilterOption[];
    movementTypes: InventoryMovementHistoryFilterOption[];
  };
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

export interface InventoryInformationListFilterOptions {
  warehouses: Array<{ value: string; label: string }>;
  tags: Array<{ value: string; label: string }>;
  clients: Array<{ value: string; label: string }>;
  skus: Array<{ value: string; label: string }>;
}

export interface InventoryInformationListResponse extends PaginatedResponse<InventoryInformationRow> {
  filterOptions: InventoryInformationListFilterOptions;
}

export type InventoryAdjustmentValues = z.infer<typeof inventoryAdjustmentSchema>;
