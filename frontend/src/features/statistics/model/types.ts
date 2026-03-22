export type StatisticsTimeWindow = "WEEK" | "MONTH" | "YEAR";

export interface StatisticsFlowRow {
  id: string;
  segment: string;
  documents: number;
  units: number;
  completed_documents: number;
  completed_units: number;
  focus: string;
}

export interface WarehouseAnalysisRow {
  id: string;
  warehouse_name: string;
  on_hand_units: number;
  standard_stock_in_orders: number;
  stock_out_orders: number;
  direct_shipping_orders: number;
  after_sales_returns: number;
}

export interface ActivityPerformanceRow {
  id: string;
  staff_name: string;
  activity_count: number;
  quantity: number;
  last_activity_at: string | null;
}

export interface StaffPerformanceRow {
  id: string;
  staff_name: string;
  receiving: number;
  listing: number;
  picking: number;
  packing: number;
  after_sales: number;
  total_activities: number;
  total_quantity: number;
  last_activity_at: string | null;
}
