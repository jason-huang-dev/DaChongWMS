import { Alert, Button, Card, CardContent, FormControlLabel, Grid, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

type FeesEditorValues<TValues> = {
  [K in keyof TValues]: string | boolean;
};

export interface FeesEditorOption {
  value: string;
  label: TranslatableText;
}

export interface FeesEditorField<TValues extends FeesEditorValues<TValues>> {
  key: keyof TValues & string;
  label: TranslatableText;
  type?: "text" | "number" | "textarea" | "date" | "datetime-local" | "select" | "checkbox";
  options?: FeesEditorOption[];
}

interface FeesEditorCardProps<TValues extends FeesEditorValues<TValues>> {
  title: TranslatableText;
  description: TranslatableText;
  fields: Array<FeesEditorField<TValues>>;
  values: TValues;
  onChange: <TKey extends keyof TValues & string>(key: TKey, value: TValues[TKey]) => void;
  onSubmit: () => Promise<unknown> | void;
  onCancel: () => void;
  isEditing: boolean;
  isSubmitting: boolean;
  successMessage: string | null;
  errorMessage: string | null;
}

export function FeesEditorCard<TValues extends FeesEditorValues<TValues>>({
  title,
  description,
  fields,
  values,
  onChange,
  onSubmit,
  onCancel,
  isEditing,
  isSubmitting,
  successMessage,
  errorMessage,
}: FeesEditorCardProps<TValues>) {
  const { t, translate } = useI18n();

  return (
    <Card>
      <CardContent>
        <Stack
          component="form"
          onSubmit={(event) => {
            event.preventDefault();
            void onSubmit();
          }}
          spacing={2}
        >
          <Stack spacing={0.5}>
            <Typography variant="h6">{translate(title)}</Typography>
            <Typography color="text.secondary" variant="body2">
              {translate(description)}
            </Typography>
          </Stack>
          {successMessage ? <Alert severity="success">{successMessage}</Alert> : null}
          {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
          <Grid container spacing={1.5}>
            {fields.map((field) => {
              if (field.type === "checkbox") {
                return (
                  <Grid key={field.key} size={{ xs: 12 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={Boolean(values[field.key])}
                          onChange={(_event, checked) => onChange(field.key, checked as TValues[typeof field.key])}
                        />
                      }
                      label={translate(field.label)}
                    />
                  </Grid>
                );
              }

              return (
                <Grid key={field.key} size={{ xs: 12, md: field.type === "textarea" ? 12 : 6 }}>
                  <TextField
                    fullWidth
                    label={translate(field.label)}
                    multiline={field.type === "textarea"}
                    minRows={field.type === "textarea" ? 3 : undefined}
                    onChange={(event) => onChange(field.key, event.target.value as TValues[typeof field.key])}
                    select={field.type === "select"}
                    type={field.type === "textarea" || field.type === "select" ? "text" : field.type}
                    value={typeof values[field.key] === "string" ? values[field.key] : ""}
                    InputLabelProps={field.type === "date" || field.type === "datetime-local" ? { shrink: true } : undefined}
                  >
                    {field.type === "select"
                      ? field.options?.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {translate(option.label)}
                          </MenuItem>
                        ))
                      : null}
                  </TextField>
                </Grid>
              );
            })}
          </Grid>
          <Stack direction="row" justifyContent="flex-end" spacing={1}>
            {isEditing ? (
              <Button disabled={isSubmitting} onClick={onCancel} variant="text">
                {t("Cancel edit")}
              </Button>
            ) : null}
            <Button disabled={isSubmitting} type="submit" variant="contained">
              {isSubmitting
                ? t("Saving...")
                : isEditing
                  ? t("Update record")
                  : t("Create record")}
            </Button>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
