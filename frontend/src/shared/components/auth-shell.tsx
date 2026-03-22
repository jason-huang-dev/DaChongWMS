import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import { useTheme } from "@mui/material/styles";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";
import { BrandLogo } from "@/shared/components/brand-logo";
import { UiPreferencesControls } from "@/shared/components/ui-preferences-controls";

interface AuthShellProps {
  children: ReactNode;
  description: string;
  eyebrow?: string;
  heroPoints?: string[];
  heroSummary?: string;
  heroTitle?: string;
  title: string;
}

const defaultHeroPoints = ["Scanner-first workflows", "Finance-ready operations", "MFA-protected access"];

export function AuthShell({
  children,
  description,
  eyebrow = "DaChongWMS",
  heroPoints = defaultHeroPoints,
  heroSummary = "Golden metal branding, dark-control surfaces, and warm enterprise tones now define the product shell and operator flows.",
  heroTitle = "Warehouse control with a branded operator surface",
  title,
}: AuthShellProps) {
  const theme = useTheme();
  const { t, translateText } = useI18n();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        alignItems: "center",
        background: isDark
          ? "radial-gradient(circle at top left, rgba(243, 197, 74, 0.2), transparent 36%), linear-gradient(135deg, #100c08 0%, #1a120b 42%, #26170e 100%)"
          : brandGradients.authBackdrop,
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
              border: `1px solid ${alpha(isDark ? brandColors.goldLight : brandColors.goldDark, 0.18)}`,
              boxShadow: brandShadows.cardStrong,
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
                      {translateText(eyebrow)}
                    </Typography>
                    <Typography sx={{ color: "text.primary", maxWidth: 420 }} variant="h4">
                      {translateText(title)}
                    </Typography>
                    <Typography color="text.secondary" sx={{ maxWidth: 420 }} variant="body1">
                      {translateText(description)}
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
              background: brandGradients.shellDrawer,
              border: `1px solid ${alpha(brandColors.gold, 0.2)}`,
              boxShadow: brandShadows.cardStrong,
              color: brandColors.inkSoft,
              display: { xs: "none", lg: "block" },
              height: "100%",
              overflow: "hidden",
              position: "relative",
            }}
          >
            <Box
              sx={{
                background:
                  "radial-gradient(circle at 30% 30%, rgba(243, 197, 74, 0.26), transparent 28%), radial-gradient(circle at 78% 72%, rgba(184, 74, 36, 0.24), transparent 26%)",
                inset: 0,
                position: "absolute",
              }}
            />
            <CardContent sx={{ height: "100%", p: 5, position: "relative" }}>
              <Stack justifyContent="space-between" sx={{ height: "100%" }}>
                <Stack spacing={3}>
                  <BrandLogo alt={t("ui.brandLogoAlt")} kind="lockup" sx={{ width: 260 }} variant="gold" />
                  <Stack spacing={1.5}>
                    <Typography sx={{ color: brandColors.goldLight, maxWidth: 520 }} variant="h3">
                      {translateText(heroTitle)}
                    </Typography>
                    <Typography sx={{ color: alpha(brandColors.inkSoft, 0.82), maxWidth: 540 }} variant="body1">
                      {translateText(heroSummary)}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1.25}>
                  {heroPoints.map((point) => (
                    <Chip
                      key={point}
                      label={translateText(point)}
                      sx={{
                        backgroundColor: alpha(brandColors.gold, 0.12),
                        border: `1px solid ${alpha(brandColors.gold, 0.28)}`,
                        color: brandColors.inkSoft,
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
