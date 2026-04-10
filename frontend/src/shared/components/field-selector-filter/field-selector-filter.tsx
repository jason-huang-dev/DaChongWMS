import type { ReactNode } from "react";

import { Stack } from "@mui/material";
import type { StackProps } from "@mui/material";
import { alpha } from "@mui/material/styles";

interface FieldSelectorFilterProps extends Omit<StackProps, "children"> {
  children: ReactNode;
}

/**
 * Shared shell for selector-led filter controls where the first field changes
 * the meaning of the adjacent input or range control.
 */
export function FieldSelectorFilter({
  children,
  sx,
  ...stackProps
}: FieldSelectorFilterProps) {
  return (
    <Stack
      alignItems="center"
      direction="row"
      spacing={1}
      useFlexGap
      {...stackProps}
      sx={[
        (theme) => {
          const isDark = theme.palette.mode === "dark";

          return {
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.52 : 0.88),
            border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.52 : 0.8)}`,
            borderRadius: 2.5,
            boxShadow: `inset 0 1px 0 ${alpha(theme.palette.common.white, isDark ? 0.05 : 0.72)}`,
            flexWrap: "wrap",
            minHeight: 42,
            minWidth: 0,
            px: 0.625,
            py: 0.375,
          };
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Stack>
  );
}
