import type { InputHTMLAttributes } from "react";

import EastRoundedIcon from "@mui/icons-material/EastRounded";
import { Box, Stack, TextField } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

type RangePickerInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "aria-label" | "onChange" | "type" | "value">;

interface RangePickerProps {
  active?: boolean;
  disabled?: boolean;
  endAriaLabel: string;
  endInputProps?: RangePickerInputProps;
  endPlaceholder?: string;
  endValue: string;
  error?: boolean;
  fieldSx?: SxProps<Theme>;
  fullWidth?: boolean;
  inputType?: InputHTMLAttributes<HTMLInputElement>["type"];
  onEndChange: (value: string) => void;
  onStartChange: (value: string) => void;
  rootSx?: SxProps<Theme>;
  startAriaLabel: string;
  startInputProps?: RangePickerInputProps;
  startPlaceholder?: string;
  startValue: string;
  step?: number;
}

export function RangePicker({
  active = false,
  disabled = false,
  endAriaLabel,
  endInputProps,
  endPlaceholder,
  endValue,
  error = false,
  fieldSx,
  fullWidth = false,
  inputType = "datetime-local",
  onEndChange,
  onStartChange,
  rootSx,
  startAriaLabel,
  startInputProps,
  startPlaceholder,
  startValue,
  step,
}: RangePickerProps) {
  return (
    <Stack
      alignItems="center"
      direction={{ xs: "column", md: "row" }}
      spacing={1}
      sx={[
        (theme) => ({
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
          border: `1px solid ${alpha(
            error ? theme.palette.error.main : active ? theme.palette.primary.main : theme.palette.divider,
            error ? 0.7 : active ? 0.72 : 0.92,
          )}`,
          borderRadius: "12px",
          height: { md: 48 },
          minHeight: { md: 48 },
          px: { xs: 1.25, md: 0.75 },
          py: { xs: 0.75, md: 0.5 },
          width: fullWidth ? "100%" : { xs: "100%", md: "auto" },
        }),
        ...(Array.isArray(rootSx) ? rootSx : rootSx ? [rootSx] : []),
      ]}
    >
      <Stack
        alignItems={{ xs: "stretch", md: "center" }}
        direction={{ xs: "column", md: "row" }}
        spacing={0.75}
        sx={{ width: fullWidth ? "100%" : { xs: "100%", md: "auto" } }}
      >
        <TextField
          disabled={disabled}
          error={error}
          onChange={(event) => onStartChange(event.target.value)}
          placeholder={startPlaceholder}
          size="small"
          slotProps={{
            htmlInput: {
              ...(startInputProps ?? {}),
              "aria-label": startAriaLabel,
              ...(typeof step === "number" ? { step } : {}),
            },
          }}
          sx={[
            {
              minWidth: { xs: "100%", md: 176 },
              "& .MuiOutlinedInput-root": {
                backgroundColor: (theme) => alpha(theme.palette.background.default, 0.34),
                height: 38,
              },
            },
            ...(Array.isArray(fieldSx) ? fieldSx : fieldSx ? [fieldSx] : []),
          ]}
          type={inputType}
          value={startValue}
        />
        <Box
          sx={(theme) => ({
            alignItems: "center",
            color: active ? theme.palette.primary.main : theme.palette.text.secondary,
            display: "inline-flex",
            flexShrink: 0,
            justifyContent: "center",
            px: { xs: 0, md: 0.25 },
          })}
        >
          <EastRoundedIcon
            sx={{
              fontSize: 18,
              transform: { xs: "rotate(90deg)", md: "none" },
            }}
          />
        </Box>
        <TextField
          disabled={disabled}
          error={error}
          onChange={(event) => onEndChange(event.target.value)}
          placeholder={endPlaceholder}
          size="small"
          slotProps={{
            htmlInput: {
              ...(endInputProps ?? {}),
              "aria-label": endAriaLabel,
              ...(typeof step === "number" ? { step } : {}),
            },
          }}
          sx={[
            {
              minWidth: { xs: "100%", md: 176 },
              "& .MuiOutlinedInput-root": {
                backgroundColor: (theme) => alpha(theme.palette.background.default, 0.34),
                height: 38,
              },
            },
            ...(Array.isArray(fieldSx) ? fieldSx : fieldSx ? [fieldSx] : []),
          ]}
          type={inputType}
          value={endValue}
        />
      </Stack>
    </Stack>
  );
}
