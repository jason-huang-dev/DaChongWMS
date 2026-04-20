import { apiGet, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

import type {
  AutomationAlertRecord,
  AutomationDashboardRecord,
  BackgroundTaskRecord,
  ScheduledTaskCreatePayload,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
} from "./types";

export const automationApi = {
  alerts: "/api/automation/alerts/",
  backgroundTaskDashboard: "/api/automation/background-tasks/dashboard/",
  backgroundTasks: "/api/automation/background-tasks/",
  evaluateAlerts: "/api/automation/background-tasks/evaluate-alerts/",
  scheduledTasks: "/api/automation/scheduled-tasks/",
  workerHeartbeats: "/api/automation/worker-heartbeats/",
} as const;

export function createScheduledTask(values: ScheduledTaskCreatePayload) {
  return apiPost<ScheduledTaskRecord>(automationApi.scheduledTasks, values);
}

export function runScheduledTaskNow(scheduledTaskId: number) {
  return apiPost<BackgroundTaskRecord>(`${automationApi.scheduledTasks}${scheduledTaskId}/run-now/`, {});
}

export function retryBackgroundTask(backgroundTaskId: number) {
  return apiPost<BackgroundTaskRecord>(`${automationApi.backgroundTasks}${backgroundTaskId}/retry/`, {});
}

export function evaluateAutomationAlerts() {
  return apiPost<{ dead_task_alerts: number; retry_alerts: number; stale_worker_alerts: number }>(automationApi.evaluateAlerts, {});
}

export function listScheduledTasks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<ScheduledTaskRecord>>(automationApi.scheduledTasks, { page, page_size: pageSize });
}

export function listBackgroundTasks(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<BackgroundTaskRecord>>(automationApi.backgroundTasks, { page, page_size: pageSize });
}

export function listWorkerHeartbeats(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<WorkerHeartbeatRecord>>(automationApi.workerHeartbeats, { page, page_size: pageSize });
}

export function listAutomationAlerts(page = 1, pageSize = 8) {
  return apiGet<PaginatedResponse<AutomationAlertRecord>>(automationApi.alerts, { page, page_size: pageSize });
}

export function fetchAutomationDashboard() {
  return apiGet<AutomationDashboardRecord>(automationApi.backgroundTaskDashboard);
}
