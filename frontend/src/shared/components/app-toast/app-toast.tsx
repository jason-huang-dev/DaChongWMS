import type { ReactNode } from "react";

import { Alert, Fade, Snackbar, type AlertColor, type SnackbarOrigin } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";

interface AppToastProps {
  open: boolean;
  message?: ReactNode | null;
  severity?: AlertColor;
  onClose: () => void;
  autoHideDuration?: number | null;
  anchorOrigin?: SnackbarOrigin;
}

export function AppToast({
  open,
  message,
  severity = "success",
  onClose,
  autoHideDuration = 1000,
  anchorOrigin = { horizontal: "center", vertical: "top" },
}: AppToastProps) {
  const theme = useTheme();
  const palette = theme.palette[severity];
  const isDark = theme.palette.mode === "dark";
  const toastBackgroundColor = palette.dark ?? palette.main;
  const toastForegroundColor = theme.palette.getContrastText(toastBackgroundColor);

  if (!message) {
    return null;
  }

  return (
    <Snackbar
      anchorOrigin={anchorOrigin}
      autoHideDuration={autoHideDuration}
      onClose={(_event, reason) => {
        if (reason === "clickaway") {
          return;
        }
        onClose();
      }}
      open={open}
      slots={{ transition: Fade }}
      sx={{
        top: {
          sm: 20,
          xs: 12,
        },
      }}
      transitionDuration={{ enter: 180, exit: 900 }}
    >
      <Alert
        onClose={onClose}
        severity={severity}
        sx={{
          alignItems: "center",
          backgroundColor: toastBackgroundColor,
          border: `1px solid ${palette.main}`,
          boxShadow: `0 0 0 1px ${alpha(palette.main, 0.22)}, 0 14px 32px ${alpha(palette.main, isDark ? 0.3 : 0.24)}`,
          color: toastForegroundColor,
          minWidth: {
            sm: 320,
            xs: "min(92vw, 360px)",
          },
          "& .MuiAlert-action": {
            alignItems: "center",
            color: toastForegroundColor,
            pt: 0,
          },
          "& .MuiAlert-icon": {
            color: toastForegroundColor,
          },
          "& .MuiIconButton-root": {
            color: toastForegroundColor,
          },
          "& .MuiAlert-message": {
            fontSize: theme.typography.pxToRem(12),
            fontWeight: 700,
          },
        }}
        variant="standard"
      >
        {message}
      </Alert>
    </Snackbar>
  );
}
