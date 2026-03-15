import type {
  AutomationAlertRecord,
  AutomationDashboardRecord,
  BackgroundTaskRecord,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { scheduledTaskCreateSchema } from "./validators";

export type {
  AutomationAlertRecord,
  AutomationDashboardRecord,
  BackgroundTaskRecord,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
};

export type ScheduledTaskCreateValues = z.infer<typeof scheduledTaskCreateSchema>;

export interface ScheduledTaskCreatePayload {
  warehouse?: number;
  customer?: number;
  name: string;
  task_type: string;
  interval_minutes: number;
  next_run_at: string;
  priority: number;
  max_attempts: number;
  is_active: boolean;
  payload: Record<string, unknown>;
  notes: string;
}
