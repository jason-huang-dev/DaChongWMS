export interface AuthSession {
  username: string;
  openid: string;
  operatorId: number;
  operatorName: string;
  operatorRole: string;
}

export interface CompanyContextRecord {
  id: string;
  openid: string;
  label: string;
  description: string;
}

export interface PendingMfaChallenge {
  username: string;
  challengeId: string;
  expiresAt: string;
  availableMethods: string[];
}

export interface WarehouseRecord {
  id: number;
  warehouse_name: string;
  warehouse_city: string;
  warehouse_address: string;
  warehouse_contact: string;
  warehouse_manager: string;
  creator: string;
  create_time: string;
  update_time: string;
}

export interface LocationRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  zone: number;
  zone_code: string;
  location_type: number;
  location_type_code: string;
  location_code: string;
  location_name: string;
  aisle: string;
  bay: string;
  level: string;
  slot: string;
  barcode: string;
  capacity_qty: string;
  max_weight: string;
  max_volume: string;
  pick_sequence: number;
  is_pick_face: boolean;
  is_locked: boolean;
  status: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface InventoryBalanceRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  location: number;
  location_code: string;
  goods: number;
  goods_code: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  on_hand_qty: string;
  allocated_qty: string;
  hold_qty: string;
  available_qty: string;
  unit_cost: string;
  currency: string;
  creator: string;
  last_movement_at: string | null;
  create_time: string;
  update_time: string;
}

export interface PurchaseOrderLineRecord {
  id: number;
  line_number: number;
  goods: number;
  goods_code: string;
  ordered_qty: string;
  received_qty: string;
  unit_cost: string;
  stock_status: string;
  status: string;
}

export interface PurchaseOrderRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  supplier: number;
  supplier_name: string;
  po_number: string;
  expected_arrival_date: string | null;
  status: string;
  reference_code: string;
  notes: string;
  lines: PurchaseOrderLineRecord[];
  creator: string;
  create_time: string;
  update_time: string;
}

export interface ReceiptLineRecord {
  id: number;
  purchase_order_line: number;
  purchase_order_line_number: number;
  asn_line: number | null;
  asn_line_number: number | null;
  goods: number;
  goods_code: string;
  receipt_location: number;
  received_qty: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  unit_cost: string;
  inventory_movement: number;
  license_plate: number | null;
  license_plate_code: string;
}

export interface ReceiptRecord {
  id: number;
  asn: number | null;
  asn_number: string | null;
  purchase_order: number;
  purchase_order_number: string;
  warehouse: number;
  warehouse_name: string;
  receipt_location: number;
  receipt_location_code: string;
  receipt_number: string;
  status: string;
  reference_code: string;
  notes: string;
  lines: ReceiptLineRecord[];
  received_by: string;
  received_at: string | null;
  create_time: string;
  update_time: string;
}

export interface PutawayTaskRecord {
  id: number;
  receipt_line: number;
  receipt_number: string;
  warehouse: number;
  warehouse_name: string;
  goods: number;
  goods_code: string;
  task_number: string;
  from_location: number;
  from_location_code: string;
  to_location: number | null;
  to_location_code: string;
  quantity: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string;
  completed_by: string;
  completed_at: string | null;
  inventory_movement: number | null;
  license_plate: number | null;
  license_plate_code: string;
  notes: string;
  create_time: string;
  update_time: string;
}

export interface SalesOrderLineRecord {
  id: number;
  line_number: number;
  goods: number;
  goods_code: string;
  ordered_qty: string;
  allocated_qty: string;
  picked_qty: string;
  shipped_qty: string;
  unit_price: string;
  stock_status: string;
  status: string;
}

export interface SalesOrderRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  customer: number;
  customer_name: string;
  staging_location: number;
  staging_location_code: string;
  order_number: string;
  requested_ship_date: string | null;
  status: string;
  reference_code: string;
  notes: string;
  lines: SalesOrderLineRecord[];
  creator: string;
  create_time: string;
  update_time: string;
  allocated_tasks?: number;
}

export interface PickTaskRecord {
  id: number;
  sales_order_line: number;
  order_number: string;
  warehouse: number;
  warehouse_name: string;
  goods: number;
  goods_code: string;
  task_number: string;
  from_location: number;
  from_location_code: string;
  to_location: number | null;
  to_location_code: string | null;
  quantity: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string;
  completed_by: string;
  completed_at: string | null;
  inventory_movement: number | null;
  license_plate: number | null;
  license_plate_code: string;
  notes: string;
  create_time: string;
  update_time: string;
}

export interface ShipmentLineRecord {
  id: number;
  sales_order_line: number;
  sales_order_line_number: number;
  goods: number;
  goods_code: string;
  from_location: number | null;
  from_location_code: string;
  shipped_qty: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  inventory_movement: number;
  license_plate: number | null;
  license_plate_code: string;
}

export interface ShipmentRecord {
  id: number;
  sales_order: number;
  order_number: string;
  warehouse: number;
  warehouse_name: string;
  staging_location: number;
  staging_location_code: string;
  shipment_number: string;
  status: string;
  reference_code: string;
  notes: string;
  lines: ShipmentLineRecord[];
  shipped_by: string;
  shipped_at: string | null;
  create_time: string;
  update_time: string;
}

export interface CountApprovalRecord {
  id: number;
  cycle_count_line: number;
  count_number: string;
  warehouse_name: string;
  line_number: number;
  location_code: string;
  goods_code: string;
  adjustment_reason_code: string | null;
  variance_qty: string;
  approval_rule: number | null;
  required_role: string;
  status: string;
  requested_by: string;
  requested_at: string;
  approved_by: string;
  approved_at: string | null;
  rejected_by: string;
  rejected_at: string | null;
  notes: string;
  creator: string;
  create_time: string;
  update_time: string;
}

export interface CycleCountLineRecord {
  id: number;
  cycle_count: number;
  line_number: number;
  inventory_balance?: number;
  location?: number;
  location_code: string;
  goods?: number;
  goods_code: string;
  stock_status: string;
  lot_number?: string;
  serial_number?: string;
  system_qty: string | null;
  counted_qty: string | null;
  variance_qty: string;
  status: string;
  assigned_to_name: string;
  recount_assigned_to_name: string;
  scanner_task_type: string;
  scanner_task_status: string;
  scanner_task_last_operator: string;
  scanner_task_acknowledged_at?: string | null;
  scanner_task_started_at?: string | null;
  scanner_task_completed_at?: string | null;
  adjustment_reason_code: string | null;
  counted_at: string | null;
  recounted_at: string | null;
  approval?: CountApprovalRecord | null;
  notes: string;
  update_time: string;
}

export interface NextCountTaskRecord extends CycleCountLineRecord {
  task_type: string;
}

export interface CountApprovalQueueRecord {
  id: number;
  count_number: string;
  warehouse_name: string;
  line_number: number;
  location_code: string;
  goods_code: string;
  adjustment_reason_code: string;
  variance_qty: string;
  required_role: string;
  status: string;
  requested_by: string;
  requested_at: string;
  rejected_by: string;
  rejected_at: string | null;
  notes: string;
  update_time: string;
}

export interface CountingDashboardSummary {
  pending_sla_hours: number;
  recount_sla_hours: number;
  pending_total: number;
  pending_sla_breach_count: number;
  pending_age_buckets: Record<string, number>;
  pending_oldest_items: Array<{
    approval_id: number;
    count_number: string;
    warehouse_name: string;
    location_code: string;
    goods_code: string;
    variance_qty: string;
    required_role: string;
    age_hours: number;
  }>;
  recount_sla_breach_count: number;
  recount_items: Array<{
    approval_id: number;
    count_number: string;
    warehouse_name: string;
    location_code: string;
    goods_code: string;
    variance_qty: string;
    line_status: string;
    recount_assigned_to: string;
    age_hours: number;
  }>;
}

export interface InvoiceFinanceApprovalRecord {
  status: string;
  submitted_at: string | null;
  submitted_by: string;
  reviewed_at: string | null;
  reviewed_by: string;
  notes: string;
}

export interface InvoiceLineRecord {
  id: number;
  charge_event: number;
  charge_type: string;
  event_date: string;
  quantity: string;
  uom: string;
  unit_rate: string;
  amount: string;
  description: string;
  reference_code: string;
}

export interface InvoiceRemittanceRecord {
  id: number;
  settlement: number;
  status: string;
  source: string;
  remittance_reference: string;
  external_reference: string;
  remitted_at: string | null;
  remitted_by: string;
  amount: string;
  currency: string;
  notes: string;
  create_time: string;
  update_time: string;
}

export interface InvoiceSettlementRecord {
  id: number;
  invoice: number;
  status: string;
  requested_amount: string;
  approved_amount: string;
  remitted_amount: string;
  currency: string;
  due_date: string | null;
  settlement_reference: string;
  submitted_at: string | null;
  submitted_by?: string;
  reviewed_at: string | null;
  reviewed_by?: string;
  completed_at: string | null;
  notes?: string;
  remittances?: InvoiceRemittanceRecord[];
  create_time: string;
  update_time: string;
}

export interface InvoiceDisputeRecord {
  id: number;
  invoice: number;
  invoice_line?: number | null;
  status: string;
  dispute_reference?: string;
  reference_code?: string;
  disputed_amount: string;
  approved_credit_amount?: string;
  reason_code: string;
  submitted_at?: string | null;
  opened_at?: string | null;
  opened_by?: string;
  reviewed_at: string | null;
  reviewed_by?: string;
  resolved_at: string | null;
  resolved_by?: string;
  notes?: string;
  resolution_notes?: string;
  create_time: string;
  update_time: string;
}

export interface CreditNoteRecord {
  id: number;
  invoice: number;
  dispute: number | null;
  credit_note_number: string;
  status: string;
  reason_code: string;
  amount: string;
  currency: string;
  reference_code: string;
  issued_at: string | null;
  issued_by: string;
  applied_at: string | null;
  applied_by: string;
  notes: string;
  create_time: string;
  update_time: string;
}

export interface InvoiceRecord {
  id: number;
  warehouse: number;
  customer: number | null;
  invoice_number: string;
  period_start: string;
  period_end: string;
  status: string;
  currency: string;
  subtotal_amount: string;
  tax_amount: string;
  total_amount: string;
  disputed_amount?: string;
  credited_amount?: string;
  issue_date?: string;
  due_date?: string | null;
  generated_at: string | null;
  generated_by: string;
  finalized_at: string | null;
  finalized_by: string;
  notes: string;
  lines: InvoiceLineRecord[];
  finance_approval: InvoiceFinanceApprovalRecord | null;
  settlement: InvoiceSettlementRecord | null;
  disputes: InvoiceDisputeRecord[];
  credit_notes: CreditNoteRecord[];
  create_time: string;
  update_time: string;
}

export interface FinanceExportRecord {
  id: number;
  status: string;
  file_name: string;
  row_count: number;
  generated_at: string | null;
  generated_by: string;
  date_from?: string | null;
  date_to?: string | null;
  period_start?: string | null;
  period_end?: string | null;
  create_time: string;
  update_time: string;
}

export interface ScheduledTaskRecord {
  id: number;
  warehouse: number | null;
  customer: number | null;
  name: string;
  task_type: string;
  interval_minutes: number;
  next_run_at: string;
  priority: number;
  max_attempts: number;
  is_active: boolean;
  payload: Record<string, unknown>;
  last_enqueued_at: string | null;
  last_completed_at: string | null;
  last_error: string;
  notes: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface BackgroundTaskRecord {
  id: number;
  scheduled_task: number | null;
  warehouse: number | null;
  customer: number | null;
  integration_job: number | null;
  report_export: number | null;
  invoice: number | null;
  task_type: string;
  status: string;
  priority: number;
  available_at: string;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  max_attempts: number;
  retry_backoff_seconds: number;
  locked_by: string;
  reference_code: string;
  payload: Record<string, unknown>;
  result_summary: Record<string, unknown>;
  last_error: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface WorkerHeartbeatRecord {
  id: number;
  worker_name: string;
  last_seen_at: string;
  last_run_started_at: string | null;
  last_run_completed_at: string | null;
  processed_count: number;
  queue_depth: number;
  last_error: string;
  metadata: Record<string, unknown>;
  create_time: string;
  update_time: string;
}

export interface AutomationAlertRecord {
  id: number;
  warehouse: number | null;
  scheduled_task: number | null;
  background_task: number | null;
  alert_type: string;
  severity: string;
  status: string;
  alert_key: string;
  summary: string;
  payload: Record<string, unknown>;
  opened_at: string;
  resolved_at: string | null;
  resolved_by: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface AutomationDashboardRecord {
  queue: {
    queued: number;
    retry: number;
    running: number;
    dead: number;
    oldest_queued_at: string;
  };
  workers: Array<{
    worker_name: string;
    last_seen_at: string;
    last_run_started_at: string;
    last_run_completed_at: string;
    processed_count: number;
    queue_depth: number;
    last_error: string;
  }>;
  alerts: Array<{
    id: number;
    alert_type: string;
    severity: string;
    summary: string;
    alert_key: string;
    opened_at: string;
  }>;
}

export interface WebhookEventRecord {
  id: number;
  warehouse: number | null;
  system_type: string;
  source_system: string;
  event_type: string;
  event_key: string;
  signature: string;
  headers: Record<string, unknown>;
  payload: Record<string, unknown>;
  reference_code: string;
  status: string;
  received_at: string;
  processed_at: string | null;
  last_error: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface IntegrationJobRecord {
  id: number;
  warehouse: number | null;
  source_webhook: number | null;
  system_type: string;
  integration_name: string;
  job_type: string;
  direction: string;
  status: string;
  reference_code: string;
  external_reference: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  attempt_count: number;
  triggered_by: string;
  last_error: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface IntegrationLogRecord {
  id: number;
  job: number | null;
  webhook_event: number | null;
  level: string;
  message: string;
  payload: Record<string, unknown>;
  logged_at: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface CarrierBookingRecord {
  id: number;
  warehouse: number;
  shipment: number | null;
  booking_job: number | null;
  label_job: number | null;
  booking_number: string;
  carrier_code: string;
  service_level: string;
  package_count: number;
  total_weight: string | null;
  status: string;
  tracking_number: string;
  label_format: string;
  label_document: string;
  external_reference: string;
  request_payload: Record<string, unknown>;
  response_payload: Record<string, unknown>;
  booked_by: string;
  booked_at: string | null;
  labeled_at: string | null;
  last_error: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface TransferLineRecord {
  id: number;
  transfer_order: number;
  line_number: number;
  goods: number;
  goods_code: string;
  from_location: number;
  from_location_code: string;
  to_location: number | null;
  to_location_code: string;
  requested_qty: string;
  moved_qty: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string;
  completed_by: string;
  completed_at: string | null;
  inventory_movement: number | null;
  notes: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface TransferOrderRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  transfer_number: string;
  requested_date: string | null;
  reference_code: string;
  status: string;
  notes: string;
  lines: TransferLineRecord[];
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface ReplenishmentRuleRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  goods: number;
  goods_code: string;
  source_location: number;
  source_location_code: string;
  target_location: number;
  target_location_code: string;
  minimum_qty: string;
  target_qty: string;
  stock_status: string;
  priority: number;
  is_active: boolean;
  notes: string;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface ReplenishmentTaskRecord {
  id: number;
  replenishment_rule: number;
  warehouse: number;
  warehouse_name: string;
  source_balance: number;
  goods: number;
  goods_code: string;
  task_number: string;
  from_location: number;
  from_location_code: string;
  to_location: number | null;
  to_location_code: string;
  quantity: string;
  priority: number;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  status: string;
  assigned_to: number | null;
  assigned_to_name: string;
  completed_by: string;
  completed_at: string | null;
  inventory_movement: number | null;
  notes: string;
  generated_at: string | null;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface ReturnLineRecord {
  id: number;
  line_number: number;
  goods: number;
  goods_code: string;
  expected_qty: string;
  received_qty: string;
  disposed_qty: string;
  status: string;
  return_reason: string;
  notes: string;
}

export interface ReturnOrderRecord {
  id: number;
  warehouse: number;
  warehouse_name: string;
  customer: number;
  customer_name: string;
  sales_order: number | null;
  sales_order_number: string;
  return_number: string;
  requested_date: string | null;
  reference_code: string;
  status: string;
  notes: string;
  lines: ReturnLineRecord[];
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface ReturnReceiptRecord {
  id: number;
  return_line: number;
  return_number: string;
  line_number: number;
  goods_code: string;
  warehouse: number;
  warehouse_name: string;
  receipt_location: number;
  receipt_location_code: string;
  receipt_number: string;
  received_qty: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  notes: string;
  received_by: string;
  received_at: string | null;
  inventory_movement: number | null;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface ReturnDispositionRecord {
  id: number;
  return_receipt: number;
  return_number: string;
  receipt_number: string;
  goods_code: string;
  warehouse: number;
  disposition_number: string;
  disposition_type: string;
  quantity: string;
  to_location: number | null;
  to_location_code: string;
  notes: string;
  completed_by: string;
  completed_at: string | null;
  inventory_movement: number | null;
  creator: string;
  openid: string;
  create_time: string;
  update_time: string;
}

export interface StaffRecord {
  id: number;
  staff_name: string;
  staff_type: string;
  check_code: number;
  create_time: string;
  update_time: string;
  error_check_code_counter: number;
  is_lock: boolean;
}
