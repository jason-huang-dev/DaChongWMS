import { Button, Grid, Stack } from "@mui/material";
import { FormProvider, type UseFormReturn } from "react-hook-form";

import { automationTaskTypeOptions } from "@/features/automation/model/mappers";
import type { ScheduledTaskCreateValues } from "@/features/automation/model/types";
import { FormAutocomplete } from "@/shared/components/form-autocomplete";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import { MutationCard } from "@/shared/components/mutation-card";
import type { WarehouseRecord } from "@/shared/types/domain";
import type { ReferenceOption } from "@/shared/types/options";

const taskTypeOptions: ReferenceOption<string>[] = automationTaskTypeOptions.map((option) => ({
  ...option,
  record: option.value,
}));

interface ScheduledTaskFormProps {
  customerOptions: ReferenceOption<number, { customerId: number; customerName: string }> [];
  customerLoading: boolean;
  errorMessage?: string | null;
  form: UseFormReturn<ScheduledTaskCreateValues>;
  isPending: boolean;
  onSubmit: (values: ScheduledTaskCreateValues) => void;
  successMessage?: string | null;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
}

export function ScheduledTaskForm({
  customerOptions,
  customerLoading,
  errorMessage,
  form,
  isPending,
  onSubmit,
  successMessage,
  warehouseReference,
}: ScheduledTaskFormProps) {
  return (
    <MutationCard
      description="Create DB-backed schedules for reporting, finance, and storage workflows from warehouse and customer selectors."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Create scheduled task"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <Grid container spacing={1.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <ReferenceAutocompleteField label="Warehouse" name="warehouse" reference={warehouseReference} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Customer" name="customer" options={customerOptions} loading={customerLoading} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormAutocomplete label="Task type" name="task_type" options={taskTypeOptions} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Task name" name="name" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField label="Interval minutes" name="interval_minutes" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <FormTextField InputLabelProps={{ shrink: true }} label="Next run at" name="next_run_at" type="datetime-local" />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormTextField label="Priority" name="priority" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <FormTextField label="Max attempts" name="max_attempts" type="number" />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <FormSwitchField label="Active schedule" name="is_active" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Payload JSON" multiline minRows={5} name="payload_json" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormTextField label="Notes" multiline minRows={2} name="notes" />
            </Grid>
          </Grid>
          <Button disabled={isPending} type="submit" variant="contained">
            {isPending ? "Creating..." : "Create scheduled task"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
