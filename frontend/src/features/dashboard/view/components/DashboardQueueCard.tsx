import type { ReactNode } from "react";

import { Box, Card, CardContent, Link, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { brandColors, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

export type DashboardQueueMetricTone = "info" | "success" | "warning" | "danger" | "neutral";

export interface DashboardQueueMetric {
  key: string;
  label: string;
  value: ReactNode;
  to?: string;
  tone?: DashboardQueueMetricTone;
}

export interface DashboardQueueSection {
  key: string;
  title: string;
  icon?: ReactNode;
  iconTone?: DashboardQueueMetricTone;
  metrics: DashboardQueueMetric[];
  columns?: number;
}

interface DashboardQueueCardProps {
  title?: string;
  subtitle?: string;
  icon?: ReactNode;
  iconTone?: DashboardQueueMetricTone;
  metrics?: DashboardQueueMetric[];
  columns?: number;
  sections?: DashboardQueueSection[];
}

export function DashboardQueueCard({
  title,
  subtitle,
  icon,
  iconTone = "neutral",
  metrics,
  columns = 1,
  sections,
}: DashboardQueueCardProps) {
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

  const resolvedSections: DashboardQueueSection[] = sections && sections.length > 0
    ? sections
    : title && metrics
      ? [{ key: title, title, icon, iconTone, metrics, columns }]
      : [];

  function getMetricValueColor(metric: DashboardQueueMetric) {
    if (metric.tone === "danger") {
      return getToneColor(metric.tone);
    }
    return theme.palette.text.primary;
  }

  return (
    <Card
      sx={{
        background: isDark
          ? `linear-gradient(180deg, ${alpha(brandColors.surfaceDarkSecondary, 0.98)} 0%, ${alpha(brandColors.surfaceDark, 0.98)} 100%)`
          : `linear-gradient(180deg, ${brandColors.surfaceLight} 0%, ${alpha(brandColors.surfaceLight, 0.96)} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.45 : 0.6)}`,
        borderRadius: 3,
        boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
        height: "100%",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ height: "100%", p: 3, "&:last-child": { pb: 3 } }}>
        <Stack spacing={2.25} sx={{ height: "100%" }}>
          {subtitle ? (
            <Typography color="text.secondary" variant="body2">
              {translateText(subtitle)}
            </Typography>
          ) : null}
          <Stack spacing={2.25} sx={{ flexGrow: 1 }}>
            {resolvedSections.map((section, sectionIndex) => {
              const sectionColumns = Math.max(section.columns ?? 1, 1);
              const sectionToneColor = getToneColor(section.iconTone);

              return (
                <Stack
                  key={section.key ?? `${section.title}-${sectionIndex}`}
                  spacing={2}
                  sx={{
                    borderTop: sectionIndex === 0 ? "none" : `1px dashed ${alpha(theme.palette.divider, isDark ? 0.55 : 0.75)}`,
                    pt: sectionIndex === 0 ? 0 : 2.25,
                  }}
                >
                  <Stack alignItems="center" direction="row" spacing={1.1}>
                    {section.icon ? (
                      <Box sx={{ color: sectionToneColor, display: "flex", flexShrink: 0 }}>
                        {section.icon}
                      </Box>
                    ) : null}
                    <Typography sx={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", minWidth: 0 }}>
                      {translateText(section.title)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      columnGap: sectionColumns > 1 ? 0 : 1.75,
                      display: "grid",
                      gridTemplateColumns: `repeat(${sectionColumns}, minmax(0, 1fr))`,
                      rowGap: 2,
                    }}
                  >
                    {section.metrics.map((metric, metricIndex) => {
                      const translatedLabel = translateText(metric.label);
                      const valueColor = getMetricValueColor(metric);
                      const showColumnDivider = sectionColumns > 1 && metricIndex % sectionColumns !== 0;

                      return (
                        <Stack
                          key={metric.key}
                          spacing={0.8}
                          sx={{
                            borderLeft: showColumnDivider ? `1px dashed ${alpha(theme.palette.divider, isDark ? 0.5 : 0.8)}` : "none",
                            minHeight: 68,
                            minWidth: 0,
                            pl: showColumnDivider ? 2 : 0,
                          }}
                        >
                          <Typography
                            color="text.secondary"
                            sx={{
                              fontSize: 13,
                              fontWeight: 500,
                              lineHeight: 1.35,
                              minHeight: 36,
                              textWrap: "balance",
                            }}
                          >
                            {translatedLabel}
                          </Typography>
                          {metric.to ? (
                            <Link
                              aria-label={translatedLabel}
                              color="inherit"
                              component={RouterLink}
                              sx={{
                                "&:focus-visible": {
                                  outline: `2px solid ${alpha(valueColor, 0.85)}`,
                                  outlineOffset: 2,
                                },
                                alignSelf: "flex-start",
                                color: valueColor,
                                fontSize: 23,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                lineHeight: 1,
                                textDecoration: "none",
                                transition: [
                                  `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                  `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                ].join(", "),
                                "&:hover": {
                                  color: metric.tone === "danger" ? valueColor : brandColors.accentStrong,
                                  transform: "translateX(1px)",
                                },
                              }}
                              to={metric.to}
                              underline="none"
                            >
                              {metric.value}
                            </Link>
                          ) : (
                            <Typography
                              sx={{
                                color: valueColor,
                                fontSize: 23,
                                fontWeight: 800,
                                letterSpacing: "-0.03em",
                                lineHeight: 1,
                              }}
                            >
                              {metric.value}
                            </Typography>
                          )}
                        </Stack>
                      );
                    })}
                  </Box>
                </Stack>
              );
            })}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}
