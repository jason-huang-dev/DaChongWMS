import { Controller, useFormContext } from "react-hook-form";
import { TextField, type TextFieldProps } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";

interface FormTextFieldProps extends Omit<TextFieldProps, "name"> {
  name: string;
}

export function FormTextField({ name, helperText, ...props }: FormTextFieldProps) {
  const { control } = useFormContext();
  const { translateText } = useI18n();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          {...props}
          error={fieldState.invalid}
          helperText={fieldState.error?.message ?? (typeof helperText === "string" ? translateText(helperText) : helperText)}
          fullWidth={props.fullWidth ?? true}
          label={typeof props.label === "string" ? translateText(props.label) : props.label}
        />
      )}
    />
  );
}
