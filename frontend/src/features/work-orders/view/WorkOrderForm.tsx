import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import type { ClientAccountRecord } from "@/features/clients/model/types";
import type { WorkOrderTypeRecord } from "@/features/work-orders/model/types";
import type { WarehouseRecord } from "@/shared/types/domain";
import type { WorkOrderFormValues } from "@/features/work-orders/model/types";
import { workOrderFormSchema } from "@/features/work-orders/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface WorkOrderFormProps {
  defaultValues: WorkOrderFormValues;
  workOrderTypes: WorkOrderTypeRecord[];
  warehouses: WarehouseRecord[];
  customerAccounts: ClientAccountRecord[];
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: WorkOrderFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function WorkOrderForm({
  defaultValues,
  workOrderTypes,
  warehouses,
  customerAccounts,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: WorkOrderFormProps) {
  const { translateText } = useI18n();
  const form = useForm<WorkOrderFormValues>({
    defaultValues,
    resolver: zodResolver(workOrderFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Schedule the execution queue, assign urgency, and make it explicit which orders should be fulfilled first."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit work order" : "Create work order"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Work order type" name="work_order_type_id" select>
            {workOrderTypes.map((workOrderType) => (
              <MenuItem key={workOrderType.id} value={String(workOrderType.id)}>
                {workOrderType.name}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Work order title" name="title" />
          <FormTextField label="Source reference" name="source_reference" />
          <FormTextField label="Warehouse" name="warehouse_id" select>
            <MenuItem value="">All / none</MenuItem>
            {warehouses.map((warehouse) => (
              <MenuItem key={warehouse.id} value={String(warehouse.id)}>
                {warehouse.warehouse_name}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Client account" name="customer_account_id" select>
            <MenuItem value="">None</MenuItem>
            {customerAccounts.map((customerAccount) => (
              <MenuItem key={customerAccount.id} value={String(customerAccount.id)}>
                {customerAccount.name}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Status" name="status" select>
            <MenuItem value="PENDING_REVIEW">Pending review</MenuItem>
            <MenuItem value="READY">Ready</MenuItem>
            <MenuItem value="SCHEDULED">Scheduled</MenuItem>
            <MenuItem value="IN_PROGRESS">In progress</MenuItem>
            <MenuItem value="BLOCKED">Blocked</MenuItem>
            <MenuItem value="COMPLETED">Completed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </FormTextField>
          <FormTextField helperText="Leave blank to use the selected type default." label="Urgency override" name="urgency" select>
            <MenuItem value="">Use type default</MenuItem>
            <MenuItem value="LOW">Low</MenuItem>
            <MenuItem value="MEDIUM">Medium</MenuItem>
            <MenuItem value="HIGH">High</MenuItem>
            <MenuItem value="CRITICAL">Critical</MenuItem>
          </FormTextField>
          <FormTextField
            helperText="Leave blank to use the selected type default."
            label="Priority score override"
            name="priority_score"
          />
          <FormTextField label="Assignee" name="assignee_name" />
          <FormTextField label="Scheduled start" name="scheduled_start_at" slotProps={{ inputLabel: { shrink: true } }} type="datetime-local" />
          <FormTextField label="Due time" name="due_at" slotProps={{ inputLabel: { shrink: true } }} type="datetime-local" />
          <FormTextField label="Estimated duration (minutes)" name="estimated_duration_minutes" />
          <FormTextField label="Notes" minRows={3} multiline name="notes" />
          {!workOrderTypes.length ? (
            <Alert severity="info">
              {translateText("Create at least one work order type before scheduling work orders.")}
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting || !workOrderTypes.length} type="submit" variant="contained">
              {isSubmitting
                ? translateText("Saving...")
                : translateText(isEditing ? "Save work order" : "Create work order")}
            </Button>
            {isEditing ? (
              <Button color="inherit" onClick={onCancelEdit} type="button">
                {translateText("Cancel edit")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}

