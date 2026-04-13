import { Controller, useFormContext } from "react-hook-form";
import { TextField, type TextFieldProps } from "@mui/material";

import { isMessageDescriptor } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface FormTextFieldProps extends Omit<TextFieldProps, "name"> {
  name: string;
}

export function FormTextField({ name, helperText, ...props }: FormTextFieldProps) {
  const { control } = useFormContext();
  const { translate } = useI18n();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          {...props}
          error={fieldState.invalid}
          helperText={
            fieldState.error?.message ??
            (typeof helperText === "string" || isMessageDescriptor(helperText) ? translate(helperText) : helperText)
          }
          fullWidth={props.fullWidth ?? true}
          label={typeof props.label === "string" || isMessageDescriptor(props.label) ? translate(props.label) : props.label}
          placeholder={
            typeof props.placeholder === "string" || isMessageDescriptor(props.placeholder)
              ? translate(props.placeholder)
              : props.placeholder
          }
        />
      )}
    />
  );
}
