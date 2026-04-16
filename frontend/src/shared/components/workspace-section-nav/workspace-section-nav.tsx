import type { ComponentType } from "react";

import { Box, Stack, Tooltip, Typography } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

export interface WorkspaceSectionNavItem {
  label: TranslatableText;
  to: string;
  icon: ComponentType<SvgIconProps>;
  exact?: boolean;
}

interface WorkspaceSectionNavProps {
  ariaLabel?: TranslatableText;
  items: WorkspaceSectionNavItem[];
}

function isItemActive(item: WorkspaceSectionNavItem, pathname: string) {
  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function WorkspaceSectionNav({ ariaLabel = "Workspace navigation", items }: WorkspaceSectionNavProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const { translate } = useI18n();

  return (
    <Box
      sx={{
        alignSelf: "flex-start",
        position: { lg: "sticky" },
        top: { lg: 78 },
        width: { xs: "100%", lg: 248 },
        zIndex: 1,
      }}
    >
      <Stack
        aria-label={translate(ariaLabel)}
        direction={{ xs: "row", lg: "column" }}
        gap={1}
        role="navigation"
        sx={{
          backdropFilter: "blur(14px)",
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.86 : 0.94),
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          borderRadius: 3,
          boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
          overflowX: "auto",
          p: 1,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const label = translate(item.label);
          const active = isItemActive(item, location.pathname);

          return (
            <Tooltip enterDelay={200} key={item.to} placement="right" title={label}>
              <Box
                aria-current={active ? "page" : undefined}
                aria-label={label}
                component={RouterLink}
                sx={{
                  alignItems: "center",
                  backgroundColor: active
                    ? alpha(brandColors.accent, isDark ? 0.16 : 0.1)
                    : alpha(theme.palette.background.paper, isDark ? 0.44 : 0.72),
                  border: `1px solid ${
                    active
                      ? alpha(brandColors.accentStrong, isDark ? 0.32 : 0.22)
                      : alpha(theme.palette.divider, 0.86)
                  }`,
                  borderRadius: 2.5,
                  boxShadow: active
                    ? `inset 3px 0 0 ${brandColors.accent}, ${isDark ? brandShadows.floatingDark : brandShadows.floatingLight}`
                    : "none",
                  color: active ? theme.palette.text.primary : alpha(theme.palette.text.primary, isDark ? 0.72 : 0.7),
                  display: "flex",
                  flex: { xs: "0 0 auto", lg: "0 0 auto" },
                  gap: 1.25,
                  minWidth: { xs: 190, lg: 0 },
                  px: 1.25,
                  py: 1,
                  textDecoration: "none",
                  transition: [
                    `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                    `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                  ].join(", "),
                  "&:hover": {
                    backgroundColor: active
                      ? alpha(brandColors.accent, isDark ? 0.22 : 0.14)
                      : alpha(theme.palette.background.paper, isDark ? 0.66 : 0.98),
                    borderColor: alpha(active ? brandColors.accentStrong : theme.palette.text.primary, isDark ? 0.38 : 0.24),
                    transform: "translateY(-1px)",
                  },
                }}
                to={item.to}
              >
                <Box
                  sx={{
                    alignItems: "center",
                    backgroundColor: active
                      ? alpha(brandColors.accent, isDark ? 0.22 : 0.14)
                      : alpha(theme.palette.text.primary, isDark ? 0.08 : 0.04),
                    borderRadius: 2,
                    color: "inherit",
                    display: "inline-flex",
                    flexShrink: 0,
                    height: 34,
                    justifyContent: "center",
                    width: 34,
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
                <Typography
                  sx={{
                    fontSize: 14,
                    fontWeight: active ? 700 : 600,
                    lineHeight: 1.3,
                    whiteSpace: "nowrap",
                  }}
                >
                  {label}
                </Typography>
              </Box>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
