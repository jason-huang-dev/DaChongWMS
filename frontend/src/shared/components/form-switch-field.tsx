import { FormControlLabel, Switch } from "@mui/material";
import { Controller, useFormContext } from "react-hook-form";

interface FormSwitchFieldProps {
  name: string;
  label: string;
  disabled?: boolean;
}

export function FormSwitchField({ name, label, disabled }: FormSwitchFieldProps) {
  const { control } = useFormContext();

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
          label={label}
        />
      )}
    />
  );
}
