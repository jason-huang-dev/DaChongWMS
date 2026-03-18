import type { ReactNode } from "react";

import { Alert, Button, Chip, Stack, Typography } from "@mui/material";

interface BulkActionDescriptor {
  key: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  color?: "inherit" | "primary" | "secondary" | "success" | "error";
  variant?: "text" | "outlined" | "contained";
}

interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  actions: BulkActionDescriptor[];
  helperText?: string;
  errorMessage?: string | null;
  extraControls?: ReactNode;
}

export function BulkActionBar({
  selectedCount,
  onClear,
  actions,
  helperText,
  errorMessage,
  extraControls,
}: BulkActionBarProps) {
  if (selectedCount <= 0) {
    return null;
  }

  return (
    <Stack spacing={1.5}>
      {errorMessage ? <Alert severity="error">{errorMessage}</Alert> : null}
      <Stack
        alignItems={{ md: "center" }}
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Stack spacing={0.5}>
          <Chip color="primary" label={`${selectedCount} selected`} size="small" />
          {helperText ? (
            <Typography color="text.secondary" variant="body2">
              {helperText}
            </Typography>
          ) : null}
        </Stack>
        <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} spacing={1}>
          {extraControls}
          <Button color="inherit" onClick={onClear} size="small">
            Clear selection
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
              {action.label}
            </Button>
          ))}
        </Stack>
      </Stack>
    </Stack>
  );
}
