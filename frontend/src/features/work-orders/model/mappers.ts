import type {
  WorkOrderFormValues,
  WorkOrderRecord,
  WorkOrderTypeFormValues,
  WorkOrderTypeRecord,
} from "@/features/work-orders/model/types";

function formatDateTimeLocalInput(value: string | null) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function parseDateTimeLocalInput(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) {
    return undefined;
  }
  return new Date(trimmedValue).toISOString();
}

export const defaultWorkOrderTypeFormValues: WorkOrderTypeFormValues = {
  code: "",
  name: "",
  description: "",
  workstream: "GENERAL",
  default_urgency: "MEDIUM",
  default_priority_score: "50",
  target_sla_hours: "24",
  is_active: true,
};

export const defaultWorkOrderFormValues: WorkOrderFormValues = {
  work_order_type_id: "",
  warehouse_id: "",
  customer_account_id: "",
  title: "",
  source_reference: "",
  status: "PENDING_REVIEW",
  urgency: "",
  priority_score: "",
  assignee_name: "",
  scheduled_start_at: "",
  due_at: "",
  estimated_duration_minutes: "0",
  notes: "",
};

export function mapWorkOrderTypeToFormValues(record: WorkOrderTypeRecord): WorkOrderTypeFormValues {
  return {
    code: record.code,
    name: record.name,
    description: record.description,
    workstream: record.workstream,
    default_urgency: record.default_urgency,
    default_priority_score: String(record.default_priority_score),
    target_sla_hours: String(record.target_sla_hours),
    is_active: record.is_active,
  };
}

export function mapWorkOrderToFormValues(record: WorkOrderRecord): WorkOrderFormValues {
  return {
    work_order_type_id: String(record.work_order_type_id),
    warehouse_id: record.warehouse_id ? String(record.warehouse_id) : "",
    customer_account_id: record.customer_account_id ? String(record.customer_account_id) : "",
    title: record.title,
    source_reference: record.source_reference,
    status: record.status,
    urgency: record.urgency,
    priority_score: String(record.priority_score),
    assignee_name: record.assignee_name,
    scheduled_start_at: formatDateTimeLocalInput(record.scheduled_start_at),
    due_at: formatDateTimeLocalInput(record.due_at),
    estimated_duration_minutes: String(record.estimated_duration_minutes),
    notes: record.notes,
  };
}

export function mapWorkOrderTypeFormToPayload(values: WorkOrderTypeFormValues) {
  return {
    ...values,
    default_priority_score: Number(values.default_priority_score),
    target_sla_hours: Number(values.target_sla_hours),
  };
}

export function mapWorkOrderFormToPayload(values: WorkOrderFormValues) {
  return {
    work_order_type_id: Number(values.work_order_type_id),
    warehouse_id: values.warehouse_id ? Number(values.warehouse_id) : null,
    customer_account_id: values.customer_account_id ? Number(values.customer_account_id) : null,
    title: values.title,
    source_reference: values.source_reference,
    status: values.status,
    urgency: values.urgency || undefined,
    priority_score: values.priority_score ? Number(values.priority_score) : undefined,
    assignee_name: values.assignee_name,
    scheduled_start_at: parseDateTimeLocalInput(values.scheduled_start_at),
    due_at: parseDateTimeLocalInput(values.due_at),
    estimated_duration_minutes: Number(values.estimated_duration_minutes),
    notes: values.notes,
  };
}

