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

export type DashboardTimeWindow = "WEEK" | "MONTH" | "YEAR" | "CUSTOM";

export interface DashboardOrderStatisticsBucket {
  date: string;
  dropshipping_orders: number;
  stock_in_quantity: number;
}

export interface DashboardOrderStatisticsSummary {
  dropshipping_orders: number;
  stock_in_quantity: number;
}

export interface DashboardOrderStatistics {
  time_window: DashboardTimeWindow;
  date_from: string;
  date_to: string;
  summary: DashboardOrderStatisticsSummary;
  buckets: DashboardOrderStatisticsBucket[];
}
