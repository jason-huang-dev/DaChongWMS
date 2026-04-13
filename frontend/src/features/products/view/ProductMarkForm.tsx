import { zodResolver } from "@hookform/resolvers/zod";
import { Button, MenuItem, Stack } from "@mui/material";
import { FormProvider, useForm } from "react-hook-form";

import { useI18n } from "@/app/ui-preferences";
import type { ProductMarkFormValues } from "@/features/products/model/types";
import { productMarkFormSchema } from "@/features/products/model/validators";
import { FormSwitchField } from "@/shared/components/form-switch-field";
import { FormTextField } from "@/shared/components/form-text-field";
import { MutationCard } from "@/shared/components/mutation-card";

interface ProductMarkFormProps {
  defaultValues: ProductMarkFormValues;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage?: string | null;
  errorMessage?: string | null;
  onSubmit: (values: ProductMarkFormValues) => Promise<unknown> | unknown;
  onCancelEdit: () => void;
}

export function ProductMarkForm({
  defaultValues,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
  onSubmit,
  onCancelEdit,
}: ProductMarkFormProps) {
  const { t, translate, msg } = useI18n();
  const form = useForm<ProductMarkFormValues>({
    defaultValues,
    resolver: zodResolver(productMarkFormSchema),
    values: defaultValues,
  });

  return (
    <MutationCard
      description="Add handling, compliance, and operator-facing marks to keep warehouse and client flows aligned."
      errorMessage={errorMessage}
      successMessage={successMessage}
      title={isEditing ? "Edit product mark" : "Add product mark"}
    >
      <FormProvider {...form}>
        <Stack component="form" noValidate onSubmit={form.handleSubmit((values) => onSubmit(values))} spacing={2}>
          <FormTextField label="Mark type" name="mark_type" select>
            <MenuItem value="FRAGILE">{t("Fragile")}</MenuItem>
            <MenuItem value="BATTERY">{t("Battery")}</MenuItem>
            <MenuItem value="TEMPERATURE">{t("Temperature controlled")}</MenuItem>
            <MenuItem value="LABEL">{t("Label")}</MenuItem>
            <MenuItem value="CUSTOM">{t("Custom")}</MenuItem>
          </FormTextField>
          <FormTextField label="Mark value" name="value" />
          <FormTextField label="Notes" minRows={3} multiline name="notes" />
          <FormSwitchField label="Mark active" name="is_active" />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting ? t("Saving...") : isEditing ? t("Save product mark") : t("Add product mark")}
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
