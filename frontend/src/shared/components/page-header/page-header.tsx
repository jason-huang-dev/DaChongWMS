import { alpha, useTheme } from "@mui/material/styles";
import { Box, Stack, Typography } from "@mui/material";

import { brandColors, brandGradients } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  compact?: boolean;
}

export function PageHeader({ title, description, actions, compact = true }: PageHeaderProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();

  return (
    <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
      <Stack spacing={0.75}>
        <Box
          sx={{
            background: brandGradients.accent,
            borderRadius: 999,
            boxShadow: `0 8px 18px ${alpha(brandColors.accentStrong, isDark ? 0.22 : 0.16)}`,
            height: compact ? 4 : 6,
            width: compact ? 52 : 68,
          }}
        />
        <Typography sx={{ fontSize: compact ? 18 : undefined, lineHeight: compact ? 1.15 : undefined }} variant="h4">
          {t(title)}
        </Typography>
        {description ? (
          <Typography color="text.secondary" sx={{ fontSize: compact ? 12 : undefined }} variant="body1">
            {t(description)}
          </Typography>
        ) : null}
      </Stack>
      {actions}
    </Stack>
  );
}
