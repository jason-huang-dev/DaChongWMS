import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { AccessInviteFormValues } from "@/features/security/model/types";
import { accessInviteFormSchema } from "@/features/security/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";
import { ReferenceAutocompleteField } from "@/shared/components/reference-autocomplete-field";
import type { ReferenceListState } from "@/shared/hooks/use-reference-options";
import type { WarehouseRecord } from "@/shared/types/domain";

interface AccessInviteFormProps {
  defaultValues: AccessInviteFormValues;
  roleOptions: Array<{ label: string; value: string }>;
  isSubmitting: boolean;
  errorMessage?: string | null;
  successMessage?: string | null;
  warehouseReference: ReferenceListState<number, WarehouseRecord>;
  onSubmit: (values: AccessInviteFormValues) => Promise<unknown> | unknown;
}

export function AccessInviteForm({
  defaultValues,
  roleOptions,
  isSubmitting,
  errorMessage,
  successMessage,
  warehouseReference,
  onSubmit,
}: AccessInviteFormProps) {
  const form = useForm<AccessInviteFormValues>({
    defaultValues,
    resolver: zodResolver(accessInviteFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Issue a time-boxed invite token for a new browser user. The recipient accepts it out-of-band and sets the initial password."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Invite browser user"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Email" name="email" />
          <FormTextField label="Staff name" name="staff_name" />
          <FormTextField label="Role" name="staff_type" select>
            {roleOptions.map((role) => (
              <MenuItem key={role.value} value={role.value}>
                {role.label}
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Verification code" name="check_code" type="number" />
          <ReferenceAutocompleteField
            emptyText="No warehouses available"
            label="Default warehouse"
            name="default_warehouse"
            reference={warehouseReference}
          />
          <FormTextField label="Invite note" multiline minRows={3} name="invite_message" />
          <FormTextField label="Expires in days" name="expires_in_days" type="number" />
          <FormSwitchField label="Company admin" name="is_company_admin" />
          <FormSwitchField label="Can manage users" name="can_manage_users" />
          <Alert severity="info">Invites return a token so warehouse admins can distribute it through their own communication channel.</Alert>
          <Button disabled={isSubmitting} type="submit" variant="contained">
            {isSubmitting ? "Issuing..." : "Issue invite"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
