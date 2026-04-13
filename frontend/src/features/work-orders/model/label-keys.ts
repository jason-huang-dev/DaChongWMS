import type { TranslationKey } from "@/app/i18n";

const workOrderWorkstreamLabelKeys: Record<string, TranslationKey> = {
  GENERAL: "General",
  INBOUND: "Inbound",
  INVENTORY: "Inventory",
  OUTBOUND: "Outbound",
  RETURNS: "Returns",
};

const workOrderUrgencyLabelKeys: Record<string, TranslationKey> = {
  CRITICAL: "Critical",
  HIGH: "High",
  LOW: "Low",
  MEDIUM: "Medium",
};

const workOrderStatusLabelKeys: Record<string, TranslationKey> = {
  BLOCKED: "Blocked",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
  IN_PROGRESS: "In progress",
  PENDING_REVIEW: "Pending review",
  READY: "Ready",
  SCHEDULED: "Scheduled",
};

const workOrderSlaStatusLabelKeys: Record<string, TranslationKey> = {
  COMPLETED: "Completed",
  DUE_SOON: "Due soon",
  ON_TRACK: "On track",
  OVERDUE: "Overdue",
  UNSCHEDULED: "Unscheduled",
};

export function getWorkOrderWorkstreamLabelKey(value: string) {
  return workOrderWorkstreamLabelKeys[value] ?? null;
}

export function getWorkOrderUrgencyLabelKey(value: string) {
  return workOrderUrgencyLabelKeys[value] ?? null;
}

export function getWorkOrderStatusLabelKey(value: string) {
  return workOrderStatusLabelKeys[value] ?? null;
}

export function getWorkOrderSlaStatusLabelKey(value: string) {
  return workOrderSlaStatusLabelKeys[value] ?? null;
}
