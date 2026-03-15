import Grid from "@mui/material/Grid";
import { alpha } from "@mui/material/styles";
import { Box, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import { BrandLogo } from "@/shared/components/brand-logo";

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
  return (
    <Box
      sx={{
        alignItems: "center",
        background: brandGradients.authBackdrop,
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
              backgroundColor: alpha(brandColors.surface, 0.96),
              border: `1px solid ${alpha(brandColors.goldDark, 0.18)}`,
              boxShadow: brandShadows.cardStrong,
            }}
          >
            <CardContent sx={{ p: { xs: 3, md: 4 } }}>
              <Stack spacing={3}>
                <Stack spacing={2}>
                  <BrandLogo kind="mark" variant="gold" />
                  <Stack spacing={1}>
                    <Typography color="secondary.main" sx={{ fontWeight: 700, letterSpacing: "0.12em" }} variant="overline">
                      {eyebrow}
                    </Typography>
                    <Typography sx={{ color: "text.primary", maxWidth: 420 }} variant="h4">
                      {title}
                    </Typography>
                    <Typography color="text.secondary" sx={{ maxWidth: 420 }} variant="body1">
                      {description}
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
                  <BrandLogo kind="lockup" sx={{ width: 260 }} variant="gold" />
                  <Stack spacing={1.5}>
                    <Typography sx={{ color: brandColors.goldLight, maxWidth: 520 }} variant="h3">
                      {heroTitle}
                    </Typography>
                    <Typography sx={{ color: alpha(brandColors.inkSoft, 0.82), maxWidth: 540 }} variant="body1">
                      {heroSummary}
                    </Typography>
                  </Stack>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1.25}>
                  {heroPoints.map((point) => (
                    <Chip
                      key={point}
                      label={point}
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
