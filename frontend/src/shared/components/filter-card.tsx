import type { ReactNode } from "react";

import { Card, CardContent, Divider, Stack } from "@mui/material";
import type { CardProps } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface FilterCardProps extends Omit<CardProps, "children"> {
  children: ReactNode;
  header?: ReactNode;
  contentSx?: SxProps<Theme>;
  showDivider?: boolean;
}

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
        {
          borderRadius: 3,
          overflow: "hidden",
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      <CardContent
        sx={[
          {
            pb: "20px !important",
            pt: 2,
          },
          ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : []),
        ]}
      >
        <Stack spacing={1.75}>
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
