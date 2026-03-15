import { Controller, useFormContext } from "react-hook-form";
import { TextField, type TextFieldProps } from "@mui/material";

interface FormTextFieldProps extends Omit<TextFieldProps, "name"> {
  name: string;
}

export function FormTextField({ name, helperText, ...props }: FormTextFieldProps) {
  const { control } = useFormContext();

  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <TextField
          {...field}
          {...props}
          error={fieldState.invalid}
          helperText={fieldState.error?.message ?? helperText}
          fullWidth={props.fullWidth ?? true}
        />
      )}
    />
  );
}
