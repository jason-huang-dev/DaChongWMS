import type { ComponentType } from "react";

import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import { useI18n } from "@/app/ui-preferences";

export interface WorkspaceIconNavItem {
  label: string;
  to: string;
  icon: ComponentType<SvgIconProps>;
  exact?: boolean;
}

interface WorkspaceIconNavProps {
  ariaLabel?: string;
  items: WorkspaceIconNavItem[];
}

function isItemActive(item: WorkspaceIconNavItem, pathname: string) {
  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function WorkspaceIconNav({ ariaLabel = "Workspace navigation", items }: WorkspaceIconNavProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const { t, translate, msg } = useI18n();

  return (
    <Box
      sx={{
        alignSelf: "flex-start",
        position: { md: "sticky" },
        top: { md: 78 },
        zIndex: 1,
      }}
    >
      <Stack
        aria-label={ariaLabel}
        direction={{ xs: "row", md: "column" }}
        gap={1}
        role="navigation"
        sx={{
          backdropFilter: "blur(14px)",
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.86 : 0.94),
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          borderRadius: 3,
          boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
          overflowX: "auto",
          p: 0.75,
        }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const label = t(item.label);
          const active = isItemActive(item, location.pathname);

          return (
            <Tooltip enterDelay={200} key={item.to} placement="right" title={label}>
              <IconButton
                aria-current={active ? "page" : undefined}
                aria-label={label}
                color={active ? "primary" : "default"}
                component={RouterLink}
                size="small"
                to={item.to}
                sx={{
                  backgroundColor: active
                    ? alpha(brandColors.accent, isDark ? 0.16 : 0.12)
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
                  color: active ? theme.palette.text.primary : alpha(theme.palette.text.primary, isDark ? 0.72 : 0.68),
                  height: 40,
                  transition: [
                    `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                    `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                    `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                  ].join(", "),
                  width: 40,
                  "&:hover": {
                    backgroundColor: active
                      ? alpha(brandColors.accent, isDark ? 0.2 : 0.15)
                      : alpha(theme.palette.background.paper, isDark ? 0.66 : 0.98),
                    borderColor: alpha(active ? brandColors.accentStrong : theme.palette.text.primary, isDark ? 0.38 : 0.24),
                    transform: "translateY(-1px)",
                  },
                  "&:active": {
                    transform: "translateY(0)",
                  },
                }}
              >
                <Icon fontSize="small" />
              </IconButton>
            </Tooltip>
          );
        })}
      </Stack>
    </Box>
  );
}
