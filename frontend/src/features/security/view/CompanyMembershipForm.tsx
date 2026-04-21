import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { CompanyMembershipFormValues } from "@/features/security/model/types";
import { companyMembershipFormSchema } from "@/features/security/model/validators";
import { FormTextField } from "@/shared/components/form-text-field";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import type { WarehouseRecord } from "@/shared/types/domain";

interface CompanyMembershipFormProps {
  defaultValues: CompanyMembershipFormValues;
  roleOptions: Array<{ label: string; value: string }>;
  isEditing: boolean;
  isSubmitting: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
  onSubmit: (values: CompanyMembershipFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function CompanyMembershipForm({
  defaultValues,
  roleOptions,
  isEditing,
  isSubmitting,
  errorMessage,
  successMessage,
  warehouseReference,
  onSubmit,
  onCancelEdit,
}: CompanyMembershipFormProps) {
  const form = useForm<CompanyMembershipFormValues>({
    defaultValues,
    resolver: zodResolver(companyMembershipFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Provision browser accounts tied to the current company. Role selection now drives IAM access directly, including admin capabilities."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit browser account" : "Provision browser account"}
    >
      <FormProvider {...form}>
        <Stack
          component="form"
          noValidate
          onSubmit={form.handleSubmit((values) => {
            if (!isEditing && !values.password) {
              form.setError("password", { message: "Password is required for new browser accounts" });
              return;
            }
            onSubmit(values);
          })}
          spacing={2}
        >
          <FormTextField autoComplete="off" label="Username" name="username" disabled={isEditing} />
          <FormTextField autoComplete="off" label="Email" name="email" />
          <FormTextField
            autoComplete="new-password"
            label={isEditing ? "Reset password (optional)" : "Password"}
            name="password"
            type="password"
          />
          <FormTextField autoComplete="off" label="Staff name" name="staff_name" />
          <FormTextField label="Role" name="staff_type" select>
            {roleOptions.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Verification code" name="check_code" type="number" />
          <ReferenceAutocompleteField
            label="Default warehouse"
            name="default_warehouse"
            reference={warehouseReference}
            emptyText="No warehouses available"
          />
          <FormSwitchField label="Lock browser/operator access" name="is_lock" />
          <FormSwitchField label="Membership active" name="is_active" />
          <Alert severity="info">
            Company memberships now drive workspace switching and browser provisioning. Administrative access is assigned by role, not by separate boolean toggles.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save browser account" : "Provision browser account"}
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
