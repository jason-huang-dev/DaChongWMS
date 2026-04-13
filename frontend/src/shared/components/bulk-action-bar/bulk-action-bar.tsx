import type { ReactNode } from "react";

import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

interface BulkActionDescriptor {
  key: string;
  label: TranslatableText;
  onClick: () => void;
  disabled?: boolean;
  color?: "inherit" | "primary" | "secondary" | "success" | "error";
  variant?: "text" | "outlined" | "contained";
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkActionDescriptor[];
  helperText?: TranslatableText;
  errorMessage?: string | null;
  extraControls?: ReactNode;
  justifyContent?: "space-between" | "flex-start";
}

export function BulkActionBar({
  selectedCount,
  onClear,
  actions,
  helperText,
  errorMessage,
  extraControls,
  justifyContent = "space-between",
}: BulkActionBarProps) {
  const { t, translate } = useI18n();

  if (selectedCount <= 0) {
    return null;
  }

  return (
    <Stack spacing={1.5}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Stack
        alignItems={{ md: "center" }}
        direction={{ xs: "column", md: "row" }}
        justifyContent={justifyContent}
        spacing={1.5}
        sx={{
          flexWrap: justifyContent === "flex-start" ? "wrap" : undefined,
        }}
      >
        <Stack spacing={0.5}>
          <Chip color="primary" label={t("bulk.selectedCount", { count: selectedCount })} size="small" />
          {helperText ? (
            <Typography color="text.secondary" variant="body2">
              {translate(helperText)}
            </Typography>
          ) : null}
        </Stack>
        <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} spacing={1}>
          {extraControls}
          <Button color="inherit" onClick={onClear} size="small">
            {t("Clear selection")}
          </Button>
          {actions.map((action) => (
            <Button
              color={action.color ?? "primary"}
              disabled={action.disabled}
              key={action.key}
              onClick={action.onClick}
              size="small"
              variant={action.variant ?? "contained"}
            >
              {translate(action.label)}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
