import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { StaffFormValues } from "@/features/security/model/types";
import { staffFormSchema } from "@/features/security/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface SecurityFormProps {
  defaultValues: StaffFormValues;
  roleOptions: Array<{ label: string; value: string }>;
  isEditing: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  onSubmit: (values: StaffFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function SecurityForm({
  defaultValues,
  roleOptions,
  isEditing,
  isSubmitting,
  errorMessage,
  successMessage,
  onSubmit,
  onCancelEdit,
}: SecurityFormProps) {
  const form = useForm<StaffFormValues>({
    defaultValues,
    resolver: zodResolver(staffFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Manage the warehouse staff directory, role assignment, lock state, and handheld verification codes."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit staff access" : "Create staff access"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField autoComplete="off" label="Staff name" name="staff_name" />
          <FormTextField label="Role" name="staff_type" select>
            {roleOptions.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Verification code" name="check_code" type="number" />
          <FormSwitchField label="Lock access" name="is_lock" />
          <Alert severity="info">
            Use this panel for legacy handheld-only staff rows. Browser access provisioning and workspace memberships now live in the dedicated browser-account panel.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save staff record" : "Create staff record"}
            </Button>
            {isEditing ? (
              <Button color="inherit" onClick={onCancelEdit} type="button">
                Cancel edit
              </Button>
            ) : null}
          </Stack>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
