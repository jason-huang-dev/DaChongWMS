import type {
  CountingDashboardSummary,
  InventoryBalanceRecord,
  InvoiceRecord,
  PurchaseOrderRecord,
  SalesOrderRecord,
  WarehouseRecord,
} from "@/shared/types/domain";

export type { CountingDashboardSummary, InventoryBalanceRecord, InvoiceRecord, PurchaseOrderRecord, SalesOrderRecord, WarehouseRecord };

export interface CountApprovalSummary {
  pending_count: number;
  rejected_count: number;
}
