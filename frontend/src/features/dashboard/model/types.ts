import type {
  AdvanceShipmentNoticeRecord,
  CountingDashboardSummary,
  InventoryBalanceRecord,
  InvoiceRecord,
  PutawayTaskRecord,
  PurchaseOrderRecord,
  ReturnOrderRecord,
  SalesOrderRecord,
  PickTaskRecord,
  InvoiceDisputeRecord,
  InvoiceSettlementRecord,
  WarehouseRecord,
} from "@/shared/types/domain";

export type {
  AdvanceShipmentNoticeRecord,
  CountingDashboardSummary,
  InventoryBalanceRecord,
  InvoiceDisputeRecord,
  InvoiceRecord,
  InvoiceSettlementRecord,
  PickTaskRecord,
  PutawayTaskRecord,
  PurchaseOrderRecord,
  ReturnOrderRecord,
  SalesOrderRecord,
  WarehouseRecord,
};

export interface CountApprovalSummary {
  pending_count: number;
  rejected_count: number;
}
