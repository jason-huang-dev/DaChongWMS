import { FormControlLabel, Switch } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface FormSwitchFieldProps {
  name: string;
  label: TranslatableText;
  disabled?: boolean;
}

export function FormSwitchField({ name, label, disabled }: FormSwitchFieldProps) {
  const { control } = useFormContext();
  const { translate } = useI18n();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => (
        <FormControlLabel
          control={
            <Switch
              checked={Boolean(field.value)}
              disabled={disabled}
              onBlur={field.onBlur}
              onChange={(_event, checked) => field.onChange(checked)}
            />
          }
          label={translate(label)}
        />
      )}
    />
  );
}
