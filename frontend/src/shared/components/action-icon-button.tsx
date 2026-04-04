import type { ReactNode } from "react";

import { IconButton, Tooltip } from "@mui/material";
import type { IconButtonProps, TooltipProps } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

type ActionIconButtonTone = "neutral" | "primary" | "success" | "warning";

interface ActionIconButtonProps extends Omit<IconButtonProps, "children" | "title"> {
  children: ReactNode;
  sx?: SxProps<Theme>;
  title: ReactNode;
  tone?: ActionIconButtonTone;
  tooltipPlacement?: TooltipProps["placement"];
}

function buildToneStyles(theme: Theme, tone: ActionIconButtonTone) {
  const isDark = theme.palette.mode === "dark";

  switch (tone) {
    case "primary":
      return {
        backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.24 : 0.14),
        border: `1px solid ${alpha(theme.palette.primary.main, isDark ? 0.4 : 0.26)}`,
        color: theme.palette.primary.main,
        "&:hover": {
          backgroundColor: alpha(theme.palette.primary.main, isDark ? 0.3 : 0.18),
        },
      };
    case "success":
      return {
        backgroundColor: alpha(theme.palette.success.main, isDark ? 0.2 : 0.12),
        border: `1px solid ${alpha(theme.palette.success.main, isDark ? 0.34 : 0.22)}`,
        color: theme.palette.success.main,
        "&:hover": {
          backgroundColor: alpha(theme.palette.success.main, isDark ? 0.26 : 0.18),
        },
      };
    case "warning":
      return {
        backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.22 : 0.14),
        border: `1px solid ${alpha(theme.palette.warning.main, isDark ? 0.36 : 0.22)}`,
        color: theme.palette.warning.main,
        "&:hover": {
          backgroundColor: alpha(theme.palette.warning.main, isDark ? 0.28 : 0.18),
        },
      };
    case "neutral":
    default:
      return {
        backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.4 : 0.88),
        border: `1px solid ${alpha(theme.palette.divider, 0.82)}`,
        color: theme.palette.text.primary,
        "&:hover": {
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.58 : 0.98),
        },
      };
  }
}

export function ActionIconButton({
  "aria-label": ariaLabel,
  children,
  size = "small",
  sx,
  title,
  tone = "neutral",
  tooltipPlacement = "top",
  ...iconButtonProps
}: ActionIconButtonProps) {
  const resolvedAriaLabel = ariaLabel ?? (typeof title === "string" ? title : undefined);

  return (
    <Tooltip enterDelay={200} placement={tooltipPlacement} title={title}>
      <span>
        <IconButton
          {...iconButtonProps}
          aria-label={resolvedAriaLabel}
          size={size}
          sx={[
            (theme) => ({
              borderRadius: 2,
              height: 34,
              transition: theme.transitions.create(["background-color", "border-color", "color"], {
                duration: theme.transitions.duration.shorter,
              }),
              width: 34,
              ...buildToneStyles(theme, tone),
              "&.Mui-disabled": {
                backgroundColor: alpha(theme.palette.action.disabledBackground, 0.18),
                borderColor: alpha(theme.palette.action.disabled, 0.18),
              },
            }),
            ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
          ]}
        >
          {children}
        </IconButton>
      </span>
    </Tooltip>
  );
}
