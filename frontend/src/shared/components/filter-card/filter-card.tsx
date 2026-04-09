import type { ReactNode } from "react";

import { Card, CardContent, Divider, Stack } from "@mui/material";
import type { CardProps } from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

interface FilterCardProps extends Omit<CardProps, "children"> {
  children: ReactNode;
  header?: ReactNode;
  contentSx?: SxProps<Theme>;
  showDivider?: boolean;
}

/**
 * Shared container for page-level filters and tabs.
 *
 * Prefer a simple, low-chrome layout that can wrap cleanly to a second row.
 * Keep self-explanatory single-field controls as standalone children.
 * Only visually group controls inside the card when one control changes
 * the meaning of another nearby input, such as a field selector paired
 * with its search box or a metric selector paired with a range input.
 */
export function FilterCard({
  children,
  header,
  contentSx,
  showDivider = Boolean(header),
  sx,
  ...cardProps
}: FilterCardProps) {
  return (
    <Card
      {...cardProps}
      sx={[
        (theme) => ({
          background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, theme.palette.mode === "dark" ? 0.98 : 0.99)} 0%, ${alpha(theme.palette.background.default, theme.palette.mode === "dark" ? 0.9 : 0.94)} 100%)`,
          border: `1px solid ${alpha(theme.palette.divider, theme.palette.mode === "dark" ? 0.46 : 0.78)}`,
          borderRadius: 3,
          boxShadow:
            theme.palette.mode === "dark"
              ? `0 16px 34px ${alpha(theme.palette.common.black, 0.24)}`
              : `0 14px 30px ${alpha(theme.palette.common.black, 0.07)}`,
          overflow: "hidden",
        }),
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <CardContent
        sx={[
          {
            pb: "20px !important",
            pt: 2.25,
          },
          ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : []),
        ]}
      >
        <Stack spacing={2}>
          {header ? (
            <Stack spacing={1.75}>
              {header}
              {showDivider ? <Divider /> : null}
            </Stack>
          ) : null}
          {children}
        </Stack>
      </CardContent>
    </Card>
  );
}
