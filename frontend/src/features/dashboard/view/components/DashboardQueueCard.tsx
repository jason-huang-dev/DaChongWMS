import type { ReactNode } from "react";

import ChevronRightRoundedIcon from "@mui/icons-material/ChevronRightRounded";
import {
  Box,
  Card,
  CardContent,
  Link,
  Stack,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { brandColors, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

export type DashboardQueueMetricTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface DashboardQueueMetric {
  label: string;
  value: ReactNode;
  to?: string;
  tone?: DashboardQueueMetricTone;
}

interface DashboardQueueCardProps {
  title: string;
  subtitle?: string;
  metrics: DashboardQueueMetric[];
}

export function DashboardQueueCard({ title, subtitle, metrics }: DashboardQueueCardProps) {
  const theme = useTheme();
  const { translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";

  function getToneColor(tone: DashboardQueueMetricTone | undefined) {
    switch (tone) {
      case "success":
        return isDark ? brandStatusColors.success.dark : brandStatusColors.success.light;
      case "info":
        return isDark ? brandStatusColors.info.dark : brandStatusColors.info.light;
      case "warning":
        return isDark ? brandStatusColors.warning.dark : brandStatusColors.warning.light;
      case "danger":
        return isDark ? brandStatusColors.danger.dark : brandStatusColors.danger.light;
      default:
        return brandColors.accent;
    }
  }

  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ height: "100%" }}>
        <Stack spacing={2.5} sx={{ height: "100%" }}>
          <Box>
            <Typography variant="h6">{translateText(title)}</Typography>
            {subtitle ? (
              <Typography color="text.secondary" variant="body2">
                {translateText(subtitle)}
              </Typography>
            ) : null}
          </Box>
          <Stack spacing={1.25}>
            {metrics.map((metric) => {
              const toneColor = getToneColor(metric.tone);
              const content = (
                <Stack
                  alignItems="center"
                  direction="row"
                  justifyContent="space-between"
                  spacing={1.5}
                  sx={{ minHeight: 40 }}
                >
                  <Stack alignItems="center" direction="row" spacing={0.9}>
                    <Box
                      sx={{
                        backgroundColor: toneColor,
                        borderRadius: 999,
                        boxShadow: `0 0 0 4px ${alpha(toneColor, isDark ? 0.14 : 0.1)}`,
                        flexShrink: 0,
                        height: 8,
                        width: 8,
                      }}
                    />
                    <Typography color="text.secondary" variant="body2">
                      {translateText(metric.label)}
                    </Typography>
                  </Stack>
                  <Stack alignItems="center" direction="row" spacing={0.75}>
                    <Typography sx={{ color: toneColor, fontWeight: 700 }} variant="h6">
                      {metric.value}
                    </Typography>
                    {metric.to ? <ChevronRightRoundedIcon color="action" fontSize="small" /> : null}
                  </Stack>
                </Stack>
              );

              return metric.to ? (
                <Link
                  color="inherit"
                  component={RouterLink}
                  key={metric.label}
                  sx={{
                    "&:focus-visible": {
                      outline: `2px solid ${alpha(toneColor, 0.9)}`,
                      outlineOffset: 2,
                    },
                    borderRadius: 2,
                    display: "block",
                    overflow: "hidden",
                    px: 1.25,
                    py: 0.25,
                    textDecoration: "none",
                    transition: [
                      `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                      `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                      `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    ].join(", "),
                    "&:hover": {
                      bgcolor: alpha(toneColor, isDark ? 0.12 : 0.08),
                      boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
                      transform: "translateY(-1px)",
                    },
                  }}
                  to={metric.to}
                  underline="none"
                >
                  {content}
                </Link>
              ) : (
                <Box
                  key={metric.label}
                  sx={{
                    borderRadius: 2,
                    px: 1.25,
                    py: 0.25,
                    position: "relative",
                  }}
                >
                  {content}
                </Box>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
