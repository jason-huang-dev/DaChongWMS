import { useMemo } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Divider, Grid, Stack, Typography } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useScannerTaskController } from "@/features/counting/controller/useCountingController";
import { defaultScannerCompleteValues } from "@/features/counting/model/mappers";
import type { NextCountTaskRecord, ScannerCompleteValues } from "@/features/counting/model/types";
import { scannerCompleteSchema } from "@/features/counting/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { StatusChip } from "@/shared/components/status-chip";
import { formatNumber } from "@/shared/utils/format";

interface ScannerTaskPanelProps {
  task: NextCountTaskRecord | undefined;
  isLoading: boolean;
  errorMessage?: string | null;
}

export function ScannerTaskPanel({ task, isLoading, errorMessage }: ScannerTaskPanelProps) {
  const { ackMutation, completeMutation, errorMessage: actionErrorMessage, startMutation, successMessage } =
    useScannerTaskController(task?.id);
  const form = useForm<ScannerCompleteValues>({
    defaultValues: defaultScannerCompleteValues,
    resolver: zodResolver(scannerCompleteSchema),
  });

  const currentError = useMemo(() => actionErrorMessage ?? errorMessage ?? null, [actionErrorMessage, errorMessage]);

  const handleComplete = form.handleSubmit((values) => {
    if (!task) {
      return;
    }
    completeMutation.mutate(values, {
      onSuccess: () => {
        form.reset(defaultScannerCompleteValues);
      },
    });
  });

  return (
    <MutationCard
      description="Drive the assigned counting workflow from the handheld-style scanner surface. The next-task endpoint supplies the active line, and the scanner actions map directly to ack, start, and complete backend endpoints."
      errorMessage={currentError}
      successMessage={successMessage}
      title="Scanner count task"
    >
      {isLoading ? <Alert severity="info">Loading the next assigned count task...</Alert> : null}
      {!isLoading && !task ? <Alert severity="info">No active count or recount task is assigned to this operator.</Alert> : null}
      {task ? (
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2">Count line</Typography>
              <Typography variant="subtitle2">{`${task.cycle_count}-${task.line_number}`}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <Typography variant="body2">Task type</Typography>
              <Typography variant="subtitle2">{task.task_type}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">Location</Typography>
              <Typography variant="subtitle2">{task.location_code}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">SKU</Typography>
              <Typography variant="subtitle2">{task.goods_code}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">Scanner status</Typography>
              <StatusChip status={task.scanner_task_status || task.status} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">System qty</Typography>
              <Typography variant="subtitle2">{task.system_qty === null ? "--" : formatNumber(task.system_qty)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">Current counted qty</Typography>
              <Typography variant="subtitle2">{task.counted_qty === null ? "--" : formatNumber(task.counted_qty)}</Typography>
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <Typography variant="body2">Last operator</Typography>
              <Typography variant="subtitle2">{task.scanner_task_last_operator || "--"}</Typography>
            </Grid>
          </Grid>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={ackMutation.isPending} onClick={() => ackMutation.mutate()} variant="outlined">
              {ackMutation.isPending ? "Acknowledging..." : "Acknowledge"}
            </Button>
            <Button disabled={startMutation.isPending} onClick={() => startMutation.mutate()} variant="outlined">
              {startMutation.isPending ? "Starting..." : "Start"}
            </Button>
          </Stack>
          <Divider />
          <FormProvider {...form}>
            <Stack component="form" noValidate onSubmit={handleComplete} spacing={2}>
              <Grid container spacing={1.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormTextField label="Counted quantity" name="counted_qty" type="number" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormTextField label="Adjustment reason code" name="adjustment_reason_code" />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <FormTextField label="Notes" name="notes" />
                </Grid>
              </Grid>
              <Button disabled={completeMutation.isPending} type="submit" variant="contained">
                {completeMutation.isPending ? "Completing count..." : "Complete scanner count"}
              </Button>
            </Stack>
          </FormProvider>
        </Stack>
      ) : null}
    </MutationCard>
  );
}
