import { parseJsonObject, safeJsonStringify } from "@/shared/utils/json";

import type { ScheduledTaskCreatePayload, ScheduledTaskCreateValues } from "./types";

export const automationTaskTypeOptions = [
  { value: "GENERATE_KPI_SNAPSHOT", label: "Generate KPI snapshot" },
  { value: "GENERATE_OPERATIONAL_REPORT", label: "Generate operational report" },
  { value: "GENERATE_STORAGE_ACCRUAL", label: "Generate storage accrual" },
  { value: "GENERATE_INVOICE", label: "Generate invoice" },
  { value: "GENERATE_FINANCE_EXPORT", label: "Generate finance export" },
] as const;

export const defaultScheduledTaskCreateValues: ScheduledTaskCreateValues = {
  warehouse: undefined,
  customer: undefined,
  name: "",
  task_type: "GENERATE_OPERATIONAL_REPORT",
  interval_minutes: 1440,
  next_run_at: "",
  priority: 100,
  max_attempts: 3,
  is_active: true,
  payload_json: safeJsonStringify({}),
  notes: "",
};

export function mapScheduledTaskCreateValuesToPayload(
  values: ScheduledTaskCreateValues,
): ScheduledTaskCreatePayload {
  return {
    warehouse: values.warehouse,
    customer: values.customer,
    name: values.name,
    task_type: values.task_type,
    interval_minutes: values.interval_minutes,
    next_run_at: values.next_run_at,
    priority: values.priority,
    max_attempts: values.max_attempts,
    is_active: values.is_active,
    payload: parseJsonObject(values.payload_json, "Payload"),
    notes: values.notes,
  };
}
