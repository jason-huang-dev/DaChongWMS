import type { ReactNode } from "react";

import { Box, Card, CardContent, Link, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import { brandColors, brandMotion, brandStatusColors } from "@/app/brand";
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
  const { t, translate, msg } = useI18n();
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
        background: `linear-gradient(180deg, ${alpha(theme.palette.background.paper, 0.99)} 0%, ${alpha(theme.palette.background.default, 0.9)} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
        borderRadius: "14px",
        boxShadow: "none",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <CardContent sx={{ height: "100%", p: { xs: 2, md: 2.25 }, "&:last-child": { pb: { xs: 2, md: 2.25 } } }}>
        <Stack spacing={1.75} sx={{ height: "100%" }}>
          {subtitle ? (
            <Typography
              color="text.secondary"
              sx={{
                fontSize: "10px",
                fontWeight: 500,
                lineHeight: 1.45,
              }}
            >
              {t(subtitle)}
            </Typography>
          ) : null}
          <Stack spacing={1.75} sx={{ flexGrow: 1 }}>
            {resolvedSections.map((section, sectionIndex) => {
              const sectionColumns = Math.max(section.columns ?? 1, 1);
              const sectionToneColor = getToneColor(section.iconTone);

              return (
                <Stack
                  key={section.key ?? `${section.title}-${sectionIndex}`}
                  spacing={1.5}
                  sx={{
                    borderTop: sectionIndex === 0 ? "none" : `1px dashed ${alpha(theme.palette.divider, 0.72)}`,
                    pt: sectionIndex === 0 ? 0 : 1.75,
                  }}
                >
                  <Stack alignItems="center" direction="row" spacing={1}>
                    {section.icon ? (
                      <Box
                        sx={{
                          alignItems: "center",
                          backgroundColor: alpha(sectionToneColor, 0.12),
                          border: `1px solid ${alpha(sectionToneColor, 0.2)}`,
                          borderRadius: "10px",
                          color: sectionToneColor,
                          display: "inline-flex",
                          flexShrink: 0,
                          height: 28,
                          justifyContent: "center",
                          width: 28,
                        }}
                      >
                        {section.icon}
                      </Box>
                    ) : null}
                    <Typography
                      sx={{
                        fontSize: "14px",
                        fontWeight: 800,
                        letterSpacing: "-0.03em",
                        lineHeight: 1.15,
                        minWidth: 0,
                      }}
                    >
                      {t(section.title)}
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      columnGap: 1.25,
                      display: "grid",
                      gridTemplateColumns: `repeat(${sectionColumns}, minmax(0, 1fr))`,
                      rowGap: 1.25,
                    }}
                  >
                    {section.metrics.map((metric, metricIndex) => {
                      const translatedLabel = t(metric.label);
                      const valueColor = getMetricValueColor(metric);
                      const metricToneColor =
                        metric.tone && metric.tone !== "neutral"
                          ? getToneColor(metric.tone)
                          : alpha(theme.palette.text.secondary, 0.72);

                      return (
                        <Stack
                          key={metric.key}
                          spacing={0.8}
                          sx={{
                            backgroundColor: alpha(theme.palette.background.paper, 0.94),
                            border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
                            borderRadius: "10px",
                            minHeight: 60,
                            minWidth: 0,
                            overflow: "hidden",
                            pl: 1.5,
                            pr: 1.25,
                            py: 1.125,
                            position: "relative",
                            "&::before": {
                              backgroundColor: metricToneColor,
                              borderRadius: "10px 0 0 10px",
                              bottom: 0,
                              content: "\"\"",
                              left: 0,
                              position: "absolute",
                              top: 0,
                              width: 4,
                            },
                          }}
                        >
                          <Typography
                            color="text.secondary"
                            sx={{
                              fontSize: "11px",
                              fontWeight: 600,
                              lineHeight: 1.3,
                              minHeight: 28,
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
                                fontSize: "21px",
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
                                lineHeight: 1,
                                textDecoration: "none",
                                transition: [
                                  `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                  `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                                ].join(", "),
                                "&:hover": {
                                  color: metric.tone === "danger" ? valueColor : metricToneColor,
                                  transform: "translateY(-1px)",
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
                                fontSize: "21px",
                                fontWeight: 800,
                                letterSpacing: "-0.04em",
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
