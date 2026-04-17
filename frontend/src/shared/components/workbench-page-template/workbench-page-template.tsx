import type { ReactNode } from "react";

import { Box, Stack } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { SxProps, Theme } from "@mui/material/styles";

interface WorkbenchPageTemplateProps {
  children: ReactNode;
  contentSx?: SxProps<Theme>;
  hero?: ReactNode;
  navigation: ReactNode;
  shellSx?: SxProps<Theme>;
}

export function WorkbenchPageTemplate({
  children,
  contentSx,
  hero,
  navigation,
  shellSx,
}: WorkbenchPageTemplateProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Stack spacing={2.5} sx={{ height: "100%", minHeight: 0 }}>
      <Box
        sx={[
          {
            minWidth: 0,
          },
          ...(Array.isArray(shellSx) ? shellSx : shellSx ? [shellSx] : []),
        ]}
      >
        <Box
          sx={{
            borderBottom: `1px solid ${alpha(theme.palette.divider, isDark ? 0.46 : 0.78)}`,
            minWidth: 0,
            pb: 0.5,
          }}
        >
          {navigation}
        </Box>
        {hero ? <Box sx={{ minWidth: 0, pt: 2 }}>{hero}</Box> : null}
      </Box>
      <Box
        sx={[
          {
            display: "flex",
            flex: "1 1 auto",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
          },
          ...(Array.isArray(contentSx) ? contentSx : contentSx ? [contentSx] : []),
        ]}
      >
        {children}
      </Box>
    </Stack>
  );
}
