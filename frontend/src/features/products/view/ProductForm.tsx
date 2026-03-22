import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import type { ProductFormValues } from "@/features/products/model/types";
import { productFormSchema } from "@/features/products/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface ProductFormProps {
  defaultValues: ProductFormValues;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: ProductFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function ProductForm({
  defaultValues,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: ProductFormProps) {
  const form = useForm<ProductFormValues>({
    defaultValues,
    resolver: zodResolver(productFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Maintain the warehouse product master with the operational fields needed for packaging, serial tracking, distribution mapping, and handling marks."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit product" : "Create product"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="SKU" name="sku" />
          <FormTextField label="Product name" name="name" />
          <FormTextField label="Barcode" name="barcode" />
          <FormTextField label="Unit of measure" name="unit_of_measure" />
          <FormTextField label="Category" name="category" />
          <FormTextField label="Brand" name="brand" />
          <FormTextField label="Description" minRows={3} multiline name="description" />
          <FormSwitchField label="Product active" name="is_active" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? "Saving..." : isEditing ? "Save product" : "Create product"}
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
