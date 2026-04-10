import { Card, CardActionArea, CardContent, Stack, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import type { ReactNode } from "react";
import { Link as RouterLink } from "react-router-dom";

import { brandColors, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

type MetricCardTone = "neutral" | "info" | "success" | "warning" | "danger";

interface MetricCardProps {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  to?: string;
  tone?: MetricCardTone;
}

export function MetricCard({ label, value, helper, to, tone = "neutral" }: MetricCardProps) {
  const theme = useTheme();
  const { t } = useI18n();
  const isDark = theme.palette.mode === "dark";
  const toneColor =
    tone === "success"
      ? isDark
        ? brandStatusColors.success.dark
        : brandStatusColors.success.light
      : tone === "info"
        ? isDark
          ? brandStatusColors.info.dark
          : brandStatusColors.info.light
        : tone === "warning"
          ? isDark
            ? brandStatusColors.warning.dark
            : brandStatusColors.warning.light
          : tone === "danger"
            ? isDark
              ? brandStatusColors.danger.dark
              : brandStatusColors.danger.light
            : brandColors.accent;

  const content = (
    <CardContent sx={{ height: "100%" }}>
      <Stack spacing={1.15} sx={{ height: "100%" }}>
        <Stack alignItems="center" direction="row" justifyContent="space-between" spacing={1}>
          <Stack alignItems="center" direction="row" spacing={0.85}>
            <Typography color="text.secondary" variant="body2">
              {t(label)}
            </Typography>
            <span
              aria-hidden="true"
              style={{
                backgroundColor: toneColor,
                borderRadius: 999,
                boxShadow: `0 0 0 4px ${alpha(toneColor, isDark ? 0.14 : 0.1)}`,
                display: "inline-block",
                flexShrink: 0,
                height: 8,
                width: 8,
              }}
            />
          </Stack>
          {to ? (
            <Typography color="text.secondary" variant="caption">
              {t("ui.openAction")}
            </Typography>
          ) : null}
        </Stack>
        <Typography sx={{ lineHeight: 1.1 }} variant="h5">
          {value}
        </Typography>
        {helper ? (
          <Typography color="text.secondary" variant="body2">
            {helper}
          </Typography>
        ) : null}
      </Stack>
    </CardContent>
  );

  return (
    <Card
      sx={{
        height: "100%",
        overflow: "hidden",
        position: "relative",
        "&::before": {
          background: `linear-gradient(90deg, ${toneColor} 0%, ${alpha(toneColor, 0)} 100%)`,
          content: "\"\"",
          height: 3,
          left: 0,
          position: "absolute",
          right: 0,
          top: 0,
        },
      }}
    >
      {to ? (
        <CardActionArea
          component={RouterLink}
          sx={{
            alignItems: "stretch",
            display: "block",
            height: "100%",
            transition: [
              `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            ].join(", "),
            "&:hover": {
              backgroundColor: alpha(toneColor, isDark ? 0.08 : 0.06),
              boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
              transform: "translateY(-1px)",
            },
          }}
          to={to}
        >
          {content}
        </CardActionArea>
      ) : (
        content
      )}
    </Card>
  );
}
