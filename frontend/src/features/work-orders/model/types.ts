export interface WorkOrderTypeRecord {
  id: number;
  organization_id: number;
  code: string;
  name: string;
  description: string;
  workstream: string;
  default_urgency: string;
  default_priority_score: number;
  target_sla_hours: number;
  is_active: boolean;
}

export interface WorkOrderRecord {
  id: number;
  organization_id: number;
  display_code: string;
  work_order_type_id: number;
  work_order_type_name: string;
  workstream: string;
  warehouse_id: number | null;
  warehouse_name: string;
  customer_account_id: number | null;
  customer_account_name: string;
  title: string;
  source_reference: string;
  status: string;
  urgency: string;
  priority_score: number;
  assignee_name: string;
  scheduled_start_at: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_duration_minutes: number;
  notes: string;
  fulfillment_rank: number | null;
  sla_status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkOrderTypeFormValues {
  code: string;
  name: string;
  description: string;
  workstream: string;
  default_urgency: string;
  default_priority_score: string;
  target_sla_hours: string;
  is_active: boolean;
}

export interface WorkOrderFormValues {
  work_order_type_id: string;
  warehouse_id: string;
  customer_account_id: string;
  title: string;
  source_reference: string;
  status: string;
  urgency: string;
  priority_score: string;
  assignee_name: string;
  scheduled_start_at: string;
  due_at: string;
  estimated_duration_minutes: string;
  notes: string;
}

