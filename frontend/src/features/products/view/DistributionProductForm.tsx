import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ClientAccountRecord } from "@/features/clients/model/types";
import type { DistributionProductFormValues } from "@/features/products/model/types";
import { distributionProductFormSchema } from "@/features/products/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface DistributionProductFormProps {
  customerAccounts: ClientAccountRecord[];
  defaultValues: DistributionProductFormValues;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: DistributionProductFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function DistributionProductForm({
  customerAccounts,
  defaultValues,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: DistributionProductFormProps) {
  const form = useForm<DistributionProductFormValues>({
    defaultValues,
    resolver: zodResolver(distributionProductFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Map this warehouse product to external client-facing distribution SKUs and channels."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit distribution product" : "Add distribution product"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Client account" name="customer_account_id" select>
            <MenuItem value="">Select client account</MenuItem>
            {customerAccounts.map((customerAccount) => (
              <MenuItem key={customerAccount.id} value={String(customerAccount.id)}>
                {customerAccount.name} ({customerAccount.code})
              </MenuItem>
            ))}
          </FormTextField>
          <FormTextField label="Distribution SKU" name="external_sku" />
          <FormTextField label="Distribution name" name="external_name" />
          <FormTextField label="Channel" name="channel_name" />
          <FormSwitchField label="Allow dropshipping orders" name="allow_dropshipping_orders" />
          <FormSwitchField label="Allow inbound goods" name="allow_inbound_goods" />
          <FormSwitchField label="Distribution product active" name="is_active" />
          {customerAccounts.length === 0 ? (
            <Alert severity="info">
              Create a client account before adding a distribution product mapping.
            </Alert>
          ) : null}
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting || customerAccounts.length === 0} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save distribution product" : "Add distribution product"}
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
