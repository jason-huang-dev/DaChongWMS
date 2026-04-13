import { zodResolver } from "@hookform/resolvers/zod";
import { Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import type { WorkOrderTypeFormValues } from "@/features/work-orders/model/types";
import { workOrderTypeFormSchema } from "@/features/work-orders/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface WorkOrderTypeFormProps {
  defaultValues: WorkOrderTypeFormValues;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: WorkOrderTypeFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function WorkOrderTypeForm({
  defaultValues,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: WorkOrderTypeFormProps) {
  const { t, translate, msg } = useI18n();
  const form = useForm<WorkOrderTypeFormValues>({
    defaultValues,
    resolver: zodResolver(workOrderTypeFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Define reusable work-order templates with default urgency, priority, and SLA so scheduling stays consistent."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit work order type" : "Create work order type"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Type code" name="code" />
          <FormTextField label="Type name" name="name" />
          <FormTextField label="Workstream" name="workstream" select>
            <MenuItem value="INBOUND">{t("Inbound")}</MenuItem>
            <MenuItem value="OUTBOUND">{t("Outbound")}</MenuItem>
            <MenuItem value="INVENTORY">{t("Inventory")}</MenuItem>
            <MenuItem value="RETURNS">{t("Returns")}</MenuItem>
            <MenuItem value="GENERAL">{t("General")}</MenuItem>
          </FormTextField>
          <FormTextField label="Default urgency" name="default_urgency" select>
            <MenuItem value="LOW">{t("Low")}</MenuItem>
            <MenuItem value="MEDIUM">{t("Medium")}</MenuItem>
            <MenuItem value="HIGH">{t("High")}</MenuItem>
            <MenuItem value="CRITICAL">{t("Critical")}</MenuItem>
          </FormTextField>
          <FormTextField label="Default priority score" name="default_priority_score" />
          <FormTextField label="Target SLA hours" name="target_sla_hours" />
          <FormTextField label="Description" minRows={3} multiline name="description" />
          <FormSwitchField label="Work order type active" name="is_active" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting
                ? t("Saving...")
                : isEditing
                  ? t("Save work order type")
                  : t("Create work order type")}
            </Button>
            {isEditing ? (
              <Button color="inherit" onClick={onCancelEdit} type="button">
                {t("Cancel edit")}
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
