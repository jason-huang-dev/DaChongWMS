import {
  createScheduledTask,
  evaluateAutomationAlerts,
  retryBackgroundTask,
  runScheduledTaskNow,
} from "@/features/automation/model/api";
import { mapScheduledTaskCreateValuesToPayload } from "@/features/automation/model/mappers";
import type { ScheduledTaskCreateValues } from "@/features/automation/model/types";

export function runScheduledTaskCreate(values: ScheduledTaskCreateValues) {
  return createScheduledTask(mapScheduledTaskCreateValuesToPayload(values));
}

export function runScheduledTaskImmediate(scheduledTaskId: number) {
  return runScheduledTaskNow(scheduledTaskId);
}

export function runBackgroundTaskRetry(backgroundTaskId: number) {
  return retryBackgroundTask(backgroundTaskId);
}

export function runAutomationAlertEvaluation() {
  return evaluateAutomationAlerts();
}
