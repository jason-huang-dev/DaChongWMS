import { zodResolver } from "@hookform/resolvers/zod";
import { Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ProductPackagingFormValues } from "@/features/products/model/types";
import { productPackagingFormSchema } from "@/features/products/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface ProductPackagingFormProps {
  defaultValues: ProductPackagingFormValues;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: ProductPackagingFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function ProductPackagingForm({
  defaultValues,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: ProductPackagingFormProps) {
  const form = useForm<ProductPackagingFormValues>({
    defaultValues,
    resolver: zodResolver(productPackagingFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Define unit, carton, pallet, and custom packaging specs for storage and shipping operations."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit packaging" : "Add packaging"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Package type" name="package_type" select>
            <MenuItem value="UNIT">Unit</MenuItem>
            <MenuItem value="INNER">Inner pack</MenuItem>
            <MenuItem value="CARTON">Carton</MenuItem>
            <MenuItem value="PALLET">Pallet</MenuItem>
            <MenuItem value="CUSTOM">Custom</MenuItem>
          </FormTextField>
          <FormTextField label="Package code" name="package_code" />
          <FormTextField label="Units per package" name="units_per_package" />
          <FormTextField label="Length (cm)" name="length_cm" />
          <FormTextField label="Width (cm)" name="width_cm" />
          <FormTextField label="Height (cm)" name="height_cm" />
          <FormTextField label="Weight (kg)" name="weight_kg" />
          <FormSwitchField label="Default packaging" name="is_default" />
          <FormSwitchField label="Packaging active" name="is_active" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save packaging" : "Add packaging"}
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
