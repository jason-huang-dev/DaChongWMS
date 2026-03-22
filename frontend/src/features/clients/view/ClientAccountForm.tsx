import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ClientAccountFormValues } from "@/features/clients/model/types";
import { clientAccountFormSchema } from "@/features/clients/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface ClientAccountFormProps {
  defaultValues: ClientAccountFormValues;
  errorMessage?: string | null;
  successMessage?: string | null;
  isEditing: boolean;
  isSubmitting: boolean;
  onSubmit: (values: ClientAccountFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function ClientAccountForm({
  defaultValues,
  errorMessage,
  successMessage,
  isEditing,
  isSubmitting,
  onSubmit,
  onCancelEdit,
}: ClientAccountFormProps) {
  const form = useForm<ClientAccountFormValues>({
    defaultValues,
    resolver: zodResolver(clientAccountFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Create and maintain client accounts used for dropshipping order intake and inbound stock submissions."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit client account" : "Create client account"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Client name" name="name" />
          <FormTextField label="Client code" name="code" />
          <FormTextField label="Contact name" name="contact_name" />
          <FormTextField label="Contact email" name="contact_email" />
          <FormTextField label="Contact phone" name="contact_phone" />
          <FormTextField label="Billing email" name="billing_email" />
          <FormTextField label="Default shipping method" name="shipping_method" />
          <FormTextField label="Operational notes" minRows={3} multiline name="notes" />
          <FormSwitchField label="Client can submit dropshipping orders" name="allow_dropshipping_orders" />
          <FormSwitchField label="Client can submit inbound goods" name="allow_inbound_goods" />
          <FormSwitchField label="Client account active" name="is_active" />
          <Alert severity="info">
            Use client accounts for portal and operational ownership. External client users should be linked to these accounts through the IAM layer, not modeled as separate customer rows.
          </Alert>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save client account" : "Create client account"}
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
