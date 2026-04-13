import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";
import { BrandLogo } from "@/shared/components/brand-logo";
import { UiPreferencesControls } from "@/shared/components/ui-preferences-controls";

interface AuthShellProps {
  children: ReactNode;
  description: TranslatableText;
  eyebrow?: TranslatableText;
  heroPoints?: TranslatableText[];
  heroSummary?: TranslatableText;
  heroTitle?: TranslatableText;
  title: TranslatableText;
}

const defaultHeroPoints: TranslatableText[] = [
  "Scanner-first workflows",
  "Finance-ready operations",
  "MFA-protected access",
];

export function AuthShell({
  children,
  description,
  eyebrow = "DaChongWMS",
  heroPoints = defaultHeroPoints,
  heroSummary = "Surface layering, restrained accent highlights, and industrial typography now shape the operator shell and sign-in flows.",
  heroTitle = "Warehouse control with precision-first operator surfaces",
  title,
}: AuthShellProps) {
  const theme = useTheme();
  const { t, translate } = useI18n();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        alignItems: "center",
        background: isDark
          ? brandGradients.authBackdropDark
          : brandGradients.authBackdropLight,
        display: "flex",
        minHeight: "100vh",
        px: { xs: 2, md: 4 },
        py: { xs: 4, md: 6 },
      }}
    >
      <Grid container spacing={3} sx={{ margin: "0 auto", maxWidth: 1180, width: "100%" }}>
        <Grid size={{ xs: 12, lg: 5 }}>
          <Card
            sx={{
              backdropFilter: "blur(10px)",
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.94 : 0.96),
              border: `1px solid ${alpha(isDark ? brandColors.outlineDark : brandColors.outlineLight, 0.22)}`,
              boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={3}>
                <Stack direction="row" justifyContent="space-between" spacing={2}>
                  <BrandLogo alt={t("ui.brandLogoAlt")} kind="mark" variant="gold" />
                  <UiPreferencesControls />
                </Stack>
                <Stack spacing={2}>
                  <Stack spacing={1}>
                    <Typography color="secondary.main" sx={{ fontWeight: 700, letterSpacing: "0.12em" }} variant="overline">
                      {translate(eyebrow)}
                    </Typography>
                    <Typography sx={{ color: "text.primary", maxWidth: 420 }} variant="h4">
                      {translate(title)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ maxWidth: 420 }} variant="body1">
                      {translate(description)}
                    </Typography>
                  </Stack>
                </Stack>
                {children}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card
            sx={{
              background: isDark ? brandGradients.shellDrawerDark : brandGradients.shellDrawerLight,
              border: `1px solid ${alpha(isDark ? brandColors.outlineDark : brandColors.outlineLight, 0.26)}`,
              boxShadow: isDark ? brandShadows.panelDark : brandShadows.panelLight,
              color: isDark ? brandColors.textPrimaryDark : brandColors.textPrimaryLight,
              display: { xs: "none", lg: "block" },
              height: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                background:
                  isDark
                    ? "radial-gradient(circle at 30% 30%, rgba(249, 195, 68, 0.22), transparent 28%), radial-gradient(circle at 78% 72%, rgba(140, 146, 134, 0.16), transparent 26%)"
                    : "radial-gradient(circle at 24% 24%, rgba(249, 195, 68, 0.16), transparent 24%), radial-gradient(circle at 74% 68%, rgba(31, 35, 32, 0.08), transparent 26%)",
                inset: 0,
                position: "absolute",
              }}
            />
            <CardContent sx={{ height: "100%", p: 5, position: "relative" }}>
              <Stack justifyContent="space-between" sx={{ height: "100%" }}>
                <Stack spacing={3}>
                  <BrandLogo alt={t("ui.brandLogoAlt")} kind="lockup" sx={{ width: 260 }} variant="gold" />
                  <Stack spacing={1.5}>
                    <Typography
                      sx={{ color: isDark ? brandColors.accentSoft : brandColors.accentStrong, maxWidth: 520 }}
                      variant="h3"
                    >
                      {translate(heroTitle)}
                    </Typography>
                    <Typography
                      sx={{ color: alpha(isDark ? brandColors.textPrimaryDark : brandColors.textPrimaryLight, 0.78), maxWidth: 540 }}
                      variant="body1"
                    >
                      {translate(heroSummary)}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1.25}>
                  {heroPoints.map((point) => (
                    <Chip
                      key={point}
                      label={translate(point)}
                      sx={{
                        backgroundColor: alpha(brandColors.accent, isDark ? 0.14 : 0.12),
                        border: `1px solid ${alpha(brandColors.accentStrong, isDark ? 0.22 : 0.16)}`,
                        color: isDark ? brandColors.textPrimaryDark : brandColors.textPrimaryLight,
                        fontWeight: 600,
                      }}
                    />
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
