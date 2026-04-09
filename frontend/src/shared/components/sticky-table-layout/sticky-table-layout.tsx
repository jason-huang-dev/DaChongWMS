import type { ReactNode } from "react";

import { Box, Stack } from "@mui/material";
import type { SxProps, Theme } from "@mui/material/styles";

interface StickyTableLayoutProps {
  pageChrome?: ReactNode;
  filters?: ReactNode;
  table: ReactNode;
  spacing?: number;
  sx?: SxProps<Theme>;
  workspaceSx?: SxProps<Theme>;
}

export function StickyTableLayout({
  pageChrome,
  filters,
  table,
  spacing = 2,
  sx,
  workspaceSx,
}: StickyTableLayoutProps) {
  const chrome = pageChrome ?? filters;

  return (
    <Stack
      spacing={spacing}
      sx={[
        {
          display: "flex",
          flexDirection: "column",
          height: "100%",
          minHeight: 0,
          minWidth: 0,
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {chrome ? <Box sx={{ flex: "0 0 auto", minWidth: 0 }}>{chrome}</Box> : null}
      <Box
        sx={[
          {
            display: "flex",
            flex: "1 1 auto",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
            overflow: "hidden",
          },
          ...(Array.isArray(workspaceSx) ? workspaceSx : workspaceSx ? [workspaceSx] : []),
        ]}
      >
        {table}
      </Box>
    </Stack>
  );
}
