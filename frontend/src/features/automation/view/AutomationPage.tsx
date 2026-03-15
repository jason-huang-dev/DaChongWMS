import { useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import Grid from "@mui/material/Grid";
import { Button, Stack } from "@mui/material";
import { useForm } from "react-hook-form";

import { useAutomationController } from "@/features/automation/controller/useAutomationController";
import type { ScheduledTaskCreateValues } from "@/features/automation/model/types";
import { scheduledTaskCreateSchema } from "@/features/automation/model/validators";
import { AutomationTable } from "@/features/automation/view/AutomationTable";
import { ScheduledTaskForm } from "@/features/automation/view/ScheduledTaskForm";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { SummaryCard } from "@/shared/components/summary-card";
import { useCustomerReferenceOptions, useWarehouseReferenceOptions } from "@/shared/hooks/use-reference-options";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function AutomationPage() {
  const {
    activeWarehouse,
    alertsQuery,
    alertsView,
    backgroundTasksQuery,
    backgroundTasksView,
    createScheduledTaskMutation,
    dashboardQuery,
    defaultScheduledTaskCreateValues,
    errorMessage,
    evaluateAlertsMutation,
    retryTaskMutation,
    runNowMutation,
    scheduledTasksQuery,
    scheduledTasksView,
    successMessage,
    workerHeartbeatsQuery,
    workerHeartbeatsView,
  } = useAutomationController();
  const warehouses = useWarehouseReferenceOptions();
  const customers = useCustomerReferenceOptions();

  const form = useForm<ScheduledTaskCreateValues>({
    defaultValues: defaultScheduledTaskCreateValues,
    resolver: zodResolver(scheduledTaskCreateSchema),
  });

  const summaryItems = useMemo(() => {
    const queue = dashboardQuery.data?.queue;
    if (!queue) {
      return [];
    }
    return [
      { label: "Queued", value: queue.queued },
      { label: "Retry", value: queue.retry },
      { label: "Running", value: queue.running },
      { label: "Dead", value: queue.dead },
      { label: "Oldest queued", value: formatDateTime(queue.oldest_queued_at) },
    ];
  }, [dashboardQuery.data?.queue]);

  const alertItems = useMemo(() => {
    const alerts = dashboardQuery.data?.alerts ?? [];
    return alerts.slice(0, 4).map((alert, index) => ({
      label: `Alert ${index + 1}`,
      value: `${alert.severity} · ${alert.summary}`,
    }));
  }, [dashboardQuery.data?.alerts]);

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <Button disabled={evaluateAlertsMutation.isPending} onClick={() => evaluateAlertsMutation.mutate()} variant="outlined">
            {evaluateAlertsMutation.isPending ? "Evaluating..." : "Evaluate alerts"}
          </Button>
        }
        description="Admin/operator surface for DB-backed schedules, queue monitoring, worker health, and automation alerts."
        title="Automation"
      />
      <QueryAlert message={dashboardQuery.error ? parseApiError(dashboardQuery.error) : null} />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <ScheduledTaskForm
            customerLoading={customers.query.isLoading}
            customerOptions={customers.options}
            errorMessage={errorMessage}
            form={form}
            isPending={createScheduledTaskMutation.isPending}
            onSubmit={(values) => createScheduledTaskMutation.mutate(values)}
            successMessage={successMessage}
            warehouseReference={warehouses}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Stack spacing={2.5}>
            <SummaryCard
              description="Live queue totals from the automation dashboard endpoint."
              items={summaryItems}
              title="Queue health"
            />
            <SummaryCard
              description="Most recent open alerts returned by the automation dashboard."
              items={alertItems.length > 0 ? alertItems : [{ label: "Alerts", value: "No open alerts" }]}
              title="Open alerts"
            />
          </Stack>
        </Grid>
      </Grid>
      <AutomationTable
        activeWarehouseName={activeWarehouse?.warehouse_name ?? null}
        alertsQuery={alertsQuery}
        alertsView={alertsView}
        backgroundTasksQuery={backgroundTasksQuery}
        backgroundTasksView={backgroundTasksView}
        isRetryingTask={retryTaskMutation.isPending}
        isRunningNow={runNowMutation.isPending}
        onRetryTask={(backgroundTaskId) => retryTaskMutation.mutate(backgroundTaskId)}
        onRunNow={(scheduledTaskId) => runNowMutation.mutate(scheduledTaskId)}
        scheduledTasksQuery={scheduledTasksQuery}
        scheduledTasksView={scheduledTasksView}
        workerHeartbeatsQuery={workerHeartbeatsQuery}
        workerHeartbeatsView={workerHeartbeatsView}
      />
    </Stack>
  );
}
