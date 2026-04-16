import { useId, type ComponentType } from "react";

import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { Box, IconButton, Stack, Tooltip } from "@mui/material";
import type { SvgIconProps } from "@mui/material/SvgIcon";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, useLocation } from "react-router-dom";

import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import type { TranslatableText } from "@/app/i18n";
import { useI18n } from "@/app/ui-preferences";

export interface WorkspaceIconNavItem {
  label: TranslatableText;
  to: string;
  icon: ComponentType<SvgIconProps>;
  exact?: boolean;
}

export type WorkspaceIconNavMode = "compact" | "hidden";

export const workspaceIconNavCompactWidth = 72;
export const workspaceIconNavHiddenWidth = 28;

interface WorkspaceIconNavProps {
  ariaLabel?: TranslatableText;
  items: WorkspaceIconNavItem[];
  mode?: WorkspaceIconNavMode;
  navigationId?: string;
  hideLabel?: TranslatableText;
  showLabel?: TranslatableText;
  isSaving?: boolean;
  onHide?: () => void;
  onShow?: () => void;
}

function isItemActive(item: WorkspaceIconNavItem, pathname: string) {
  if (item.exact) {
    return pathname === item.to;
  }

  return pathname === item.to || pathname.startsWith(`${item.to}/`);
}

export function WorkspaceIconNav({
  ariaLabel = "Workspace navigation",
  items,
  mode = "compact",
  navigationId,
  hideLabel = "Hide workspace sidebar",
  showLabel = "Show workspace sidebar",
  isSaving = false,
  onHide,
  onShow,
}: WorkspaceIconNavProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const { translate } = useI18n();
  const generatedNavigationId = useId();
  const resolvedNavigationId = navigationId ?? generatedNavigationId;
  const resolvedMode = mode === "hidden" && onShow ? "hidden" : "compact";

  if (resolvedMode === "hidden") {
    const label = translate(showLabel);

    return (
      <Tooltip enterDelay={200} title={label}>
        <Box
          aria-controls={resolvedNavigationId}
          aria-expanded={false}
          aria-label={label}
          component="button"
          disabled={isSaving}
          onClick={onShow}
          sx={{
            alignSelf: "flex-start",
            alignItems: "center",
            appearance: "none",
            backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.72 : 0.88),
            border: `1px solid ${alpha(theme.palette.divider, isDark ? 0.42 : 0.9)}`,
            borderLeft: { md: 0 },
            borderRadius: { xs: 999, md: "0 18px 18px 0" },
            boxShadow: "none",
            color: alpha(theme.palette.text.primary, isDark ? 0.68 : 0.62),
            cursor: isSaving ? "not-allowed" : "pointer",
            display: "inline-flex",
            flexShrink: 0,
            height: { xs: 40, md: 92 },
            justifyContent: "center",
            m: 0,
            px: { xs: 1.25, md: 0.5 },
            py: { xs: 0.75, md: 1 },
            position: { md: "sticky" },
            top: { md: 78 },
            transition: [
              `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
              `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
            ].join(", "),
            width: { xs: "100%", md: workspaceIconNavHiddenWidth },
            "&:hover": {
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.82 : 0.96),
              borderColor: alpha(brandColors.accentStrong, isDark ? 0.22 : 0.18),
              boxShadow: brandShadows.accentGlow,
              color: alpha(theme.palette.text.primary, isDark ? 0.88 : 0.8),
              transform: { xs: "translateY(-1px)", md: "translateX(2px)" },
            },
            "&:focus-visible": {
              outline: "none",
              borderColor: alpha(brandColors.accentStrong, isDark ? 0.3 : 0.22),
              boxShadow: `${brandShadows.accentGlow}, 0 0 0 4px ${alpha(brandColors.accent, isDark ? 0.14 : 0.1)}`,
              color: alpha(theme.palette.text.primary, isDark ? 0.9 : 0.82),
            },
            "&:disabled": {
              background: alpha(theme.palette.background.paper, isDark ? 0.42 : 0.72),
              borderColor: alpha(theme.palette.divider, 0.38),
              boxShadow: "none",
              color: alpha(theme.palette.text.primary, 0.28),
              transform: "none",
            },
            "&:hover .WorkspaceIconNav-hidden-arrow, &:focus-visible .WorkspaceIconNav-hidden-arrow": {
              color: alpha(brandColors.accentStrong, isDark ? 0.86 : 0.74),
            },
          }}
          type="button"
        >
          <KeyboardArrowRightRoundedIcon
            className="WorkspaceIconNav-hidden-arrow"
            sx={{
              color: "inherit",
              fontSize: { xs: 20, md: 18 },
              transition: [
                `color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              transform: {
                xs: "rotate(90deg)",
                md: "none",
              },
            }}
          />
        </Box>
      </Tooltip>
    );
  }

  return (
    <Box
      sx={{
        alignSelf: "flex-start",
        position: { md: "sticky" },
        top: { md: 78 },
        width: { xs: "100%", md: workspaceIconNavCompactWidth },
        zIndex: 1,
      }}
    >
      <Stack
        justifyContent={{ md: "space-between" }}
        spacing={1.25}
        sx={{
          backdropFilter: "blur(14px)",
          backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.86 : 0.94),
          border: `1px solid ${alpha(theme.palette.divider, 0.9)}`,
          borderRadius: 3,
          boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
          minHeight: { md: 360 },
          p: 0.75,
        }}
      >
        <Stack alignItems="center" spacing={1}>
          <Stack
            aria-label={translate(ariaLabel)}
            direction={{ xs: "row", md: "column" }}
            id={resolvedNavigationId}
            role="navigation"
            spacing={0.75}
            sx={{ alignItems: "center", overflowX: "auto" }}
          >
            {items.map((item) => {
              const Icon = item.icon;
              const label = translate(item.label);
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
                        ? alpha(brandColors.accent, isDark ? 0.18 : 0.12)
                        : alpha(theme.palette.background.paper, isDark ? 0.44 : 0.72),
                      border: `1px solid ${
                        active
                          ? alpha(brandColors.accentStrong, isDark ? 0.34 : 0.24)
                          : alpha(theme.palette.divider, 0.86)
                      }`,
                      borderRadius: 2.75,
                      boxShadow: active
                        ? `inset 0 0 0 1px ${alpha(brandColors.accent, 0.2)}, ${isDark ? brandShadows.floatingDark : brandShadows.floatingLight}`
                        : "none",
                      color: active ? theme.palette.text.primary : alpha(theme.palette.text.primary, isDark ? 0.72 : 0.68),
                      flex: { xs: "0 0 auto", md: "0 0 44px" },
                      height: 44,
                      transition: [
                        `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                        `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                        `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                        `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                      ].join(", "),
                      width: 44,
                      "&:hover": {
                        backgroundColor: active
                          ? alpha(brandColors.accent, isDark ? 0.22 : 0.15)
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
        </Stack>
        {onHide ? (
          <Stack alignItems="center" direction={{ xs: "row", md: "column" }} spacing={0.25}>
            <Tooltip enterDelay={200} title={translate(hideLabel)}>
              <IconButton
                aria-controls={resolvedNavigationId}
                aria-expanded
                aria-label={translate(hideLabel)}
                disabled={isSaving}
                onClick={onHide}
                size="small"
              >
                <VisibilityOffOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
        ) : null}
      </Stack>
    </Box>
  );
}
