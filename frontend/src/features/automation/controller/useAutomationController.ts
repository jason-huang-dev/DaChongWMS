import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  runAutomationAlertEvaluation,
  runBackgroundTaskRetry,
  runScheduledTaskCreate,
  runScheduledTaskImmediate,
} from "@/features/automation/controller/actions";
import { defaultScheduledTaskCreateValues } from "@/features/automation/model/mappers";
import { automationApi } from "@/features/automation/model/api";
import type {
  AutomationAlertRecord,
  AutomationDashboardRecord,
  BackgroundTaskRecord,
  ScheduledTaskCreateValues,
  ScheduledTaskRecord,
  WorkerHeartbeatRecord,
} from "@/features/automation/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";
import { useResource } from "@/shared/hooks/use-resource";
import { invalidateQueryGroups } from "@/shared/lib/query-invalidation";
import { parseApiError } from "@/shared/utils/parse-api-error";

async function invalidateAutomationQueries(queryClient: ReturnType<typeof useQueryClient>) {
  await invalidateQueryGroups(queryClient, [["automation"], ["dashboard"], ["finance"]]);
}

export function useAutomationController() {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scheduledTasksQuery = usePaginatedResource<ScheduledTaskRecord>(
    ["automation", "scheduled-tasks"],
    automationApi.scheduledTasks,
    1,
    8,
  );
  const backgroundTasksQuery = usePaginatedResource<BackgroundTaskRecord>(
    ["automation", "background-tasks"],
    automationApi.backgroundTasks,
    1,
    8,
  );
  const workerHeartbeatsQuery = usePaginatedResource<WorkerHeartbeatRecord>(
    ["automation", "worker-heartbeats"],
    automationApi.workerHeartbeats,
    1,
    8,
  );
  const alertsQuery = usePaginatedResource<AutomationAlertRecord>(
    ["automation", "alerts"],
    automationApi.alerts,
    1,
    8,
  );
  const dashboardQuery = useResource<AutomationDashboardRecord>(
    ["automation", "dashboard"],
    automationApi.backgroundTaskDashboard,
  );

  const createScheduledTaskMutation = useMutation({
    mutationFn: (values: ScheduledTaskCreateValues) => runScheduledTaskCreate(values),
    onSuccess: async (schedule) => {
      setErrorMessage(null);
      setSuccessMessage(`Scheduled task ${schedule.name} created.`);
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const runNowMutation = useMutation({
    mutationFn: (scheduledTaskId: number) => runScheduledTaskImmediate(scheduledTaskId),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Background task ${task.id} queued from schedule ${task.scheduled_task}.`);
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const retryTaskMutation = useMutation({
    mutationFn: (backgroundTaskId: number) => runBackgroundTaskRetry(backgroundTaskId),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Background task ${task.id} re-queued.`);
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  const evaluateAlertsMutation = useMutation({
    mutationFn: () => runAutomationAlertEvaluation(),
    onSuccess: async (result) => {
      setErrorMessage(null);
      setSuccessMessage(
        `Alerts evaluated: ${result.dead_task_alerts} dead, ${result.retry_alerts} retry, ${result.stale_worker_alerts} stale worker alerts.`,
      );
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    alertsQuery,
    backgroundTasksQuery,
    createScheduledTaskMutation,
    dashboardQuery,
    defaultScheduledTaskCreateValues,
    errorMessage,
    evaluateAlertsMutation,
    retryTaskMutation,
    runNowMutation,
    scheduledTasksQuery,
    successMessage,
    workerHeartbeatsQuery,
  };
}

export function useScheduledTaskDetailController(scheduledTaskId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const scheduledTaskQuery = useResource<ScheduledTaskRecord>(
    ["automation", "scheduled-tasks", scheduledTaskId],
    `${automationApi.scheduledTasks}${scheduledTaskId}/`,
    undefined,
    { enabled: Boolean(scheduledTaskId) },
  );
  const backgroundTasksQuery = usePaginatedResource<BackgroundTaskRecord>(
    ["automation", "background-tasks", "scheduled-task", scheduledTaskId],
    automationApi.backgroundTasks,
    1,
    8,
    scheduledTaskId ? { scheduled_task: scheduledTaskId } : undefined,
    { enabled: Boolean(scheduledTaskId) },
  );
  const alertsQuery = usePaginatedResource<AutomationAlertRecord>(
    ["automation", "alerts", "scheduled-task", scheduledTaskId],
    automationApi.alerts,
    1,
    8,
    scheduledTaskId ? { scheduled_task: scheduledTaskId } : undefined,
    { enabled: Boolean(scheduledTaskId) },
  );

  const runNowMutation = useMutation({
    mutationFn: () => runScheduledTaskImmediate(Number(scheduledTaskId)),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Background task ${task.id} queued from schedule ${task.scheduled_task}.`);
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    alertsQuery,
    backgroundTasksQuery,
    errorMessage,
    runNowMutation,
    scheduledTaskQuery,
    successMessage,
  };
}

export function useBackgroundTaskDetailController(backgroundTaskId: string | undefined) {
  const queryClient = useQueryClient();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const backgroundTaskQuery = useResource<BackgroundTaskRecord>(
    ["automation", "background-tasks", backgroundTaskId],
    `${automationApi.backgroundTasks}${backgroundTaskId}/`,
    undefined,
    { enabled: Boolean(backgroundTaskId) },
  );
  const alertsQuery = usePaginatedResource<AutomationAlertRecord>(
    ["automation", "alerts", "background-task", backgroundTaskId],
    automationApi.alerts,
    1,
    8,
    backgroundTaskId ? { background_task: backgroundTaskId } : undefined,
    { enabled: Boolean(backgroundTaskId) },
  );

  const retryMutation = useMutation({
    mutationFn: () => runBackgroundTaskRetry(Number(backgroundTaskId)),
    onSuccess: async (task) => {
      setErrorMessage(null);
      setSuccessMessage(`Background task ${task.id} re-queued.`);
      await invalidateAutomationQueries(queryClient);
    },
    onError: (error) => {
      setSuccessMessage(null);
      setErrorMessage(parseApiError(error));
    },
  });

  return {
    alertsQuery,
    backgroundTaskQuery,
    errorMessage,
    retryMutation,
    successMessage,
  };
}
