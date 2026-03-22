import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ProductSerialManagementFormValues } from "@/features/products/model/types";
import { productSerialManagementFormSchema } from "@/features/products/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface SerialManagementFormProps {
  defaultValues: ProductSerialManagementFormValues;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: ProductSerialManagementFormValues) => Promise<unknown> | unknown;
}

export function SerialManagementForm({
  defaultValues,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
}: SerialManagementFormProps) {
  const form = useForm<ProductSerialManagementFormValues>({
    defaultValues,
    resolver: zodResolver(productSerialManagementFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Control whether serial numbers are optional or required and which workflows must capture them."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title="Serial number management"
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Tracking mode" name="tracking_mode" select>
            <MenuItem value="NONE">None</MenuItem>
            <MenuItem value="OPTIONAL">Optional</MenuItem>
            <MenuItem value="REQUIRED">Required</MenuItem>
          </FormTextField>
          <FormTextField label="Serial pattern" name="serial_pattern" />
          <FormSwitchField label="Serials must be unique" name="requires_uniqueness" />
          <FormSwitchField label="Capture serials on inbound" name="capture_on_inbound" />
          <FormSwitchField label="Capture serials on outbound" name="capture_on_outbound" />
          <FormSwitchField label="Capture serials on returns" name="capture_on_returns" />
          <Alert severity="info">
            Use required tracking for serialized electronics and other controlled inventory. Leave tracking off for bulk goods.
          </Alert>
          <Button disabled={isSubmitting} type="submit" variant="contained">
            {isSubmitting ? "Saving..." : "Save serial settings"}
          </Button>
        </Stack>
      </FormProvider>
    </MutationCard>
  );
}
