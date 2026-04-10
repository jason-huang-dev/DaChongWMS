import { useEffect, useRef } from "react";

import KeyboardArrowRightRoundedIcon from "@mui/icons-material/KeyboardArrowRightRounded";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Link as RouterLink, Outlet, useLocation } from "react-router-dom";

import { brandColors, brandMotion, brandShadows } from "@/app/brand";
import { useWorkbenchPreference } from "@/app/workspace-preferences";
import { useI18n } from "@/app/ui-preferences";
import { inventoryWorkspaceItems } from "@/features/inventory/view/inventory-navigation";
import {
  buildInventoryWorkspaceLayoutPayload,
  buildNextInventoryQuickAccessPaths,
  type InventorySidebarMode,
  isInventoryWorkspaceItemActive,
  resolveInventoryWorkspaceItem,
} from "@/features/inventory/view/inventory-workspace-preferences";

const inventoryWorkspacePagesNavigationId = "inventory-workspace-pages";

function InventoryHiddenSidebarHandle({
  controlsId,
  disabled,
  onShow,
}: {
  controlsId: string;
  disabled: boolean;
  onShow: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();
  const label = t("Show inventory sidebar");

  return (
    <Tooltip enterDelay={200} title={label}>
      <Box
        aria-controls={controlsId}
        aria-expanded={false}
        aria-label={label}
        component="button"
        disabled={disabled}
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
          cursor: disabled ? "not-allowed" : "pointer",
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
          width: { xs: "100%", md: 28 },
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
          "&:hover .InventoryHiddenSidebarHandle-arrow, &:focus-visible .InventoryHiddenSidebarHandle-arrow": {
            color: alpha(brandColors.accentStrong, isDark ? 0.86 : 0.74),
          },
        }}
        type="button"
      >
        <KeyboardArrowRightRoundedIcon
          className="InventoryHiddenSidebarHandle-arrow"
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

function InventorySidebar({
  activePath,
  isSaving,
  onHide,
}: {
  activePath: string;
  isSaving: boolean;
  onHide: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { t, translate, msg } = useI18n();

  return (
    <Box
      sx={{
        alignSelf: "flex-start",
        position: { md: "sticky" },
        top: { md: 78 },
        width: { xs: "100%", md: 72 },
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
            aria-label="Inventory workspace pages"
            id={inventoryWorkspacePagesNavigationId}
            direction={{ xs: "row", md: "column" }}
            role="navigation"
            spacing={0.75}
            sx={{ alignItems: "center", overflowX: "auto" }}
          >
            {inventoryWorkspaceItems.map((item) => {
              const Icon = item.icon;
              const active = isInventoryWorkspaceItemActive(item, activePath);
              const label = t(item.label);

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
        <Stack alignItems="center" direction={{ xs: "row", md: "column" }} spacing={0.25}>
          <Tooltip enterDelay={200} title={t("Hide inventory sidebar")}>
            <IconButton
              aria-controls={inventoryWorkspacePagesNavigationId}
              aria-expanded
              aria-label={t("Hide inventory sidebar")}
              disabled={isSaving}
              onClick={onHide}
              size="small"
            >
              <VisibilityOffOutlinedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>
    </Box>
  );
}

export function InventoryWorkspaceLayout() {
  const location = useLocation();
  const { preferenceQuery, updateWorkbenchPreference } = useWorkbenchPreference("inventory");
  const lastTrackedRouteRef = useRef<string | null>(null);

  const rawLayoutPayload =
    preferenceQuery.data?.layout_payload && typeof preferenceQuery.data.layout_payload === "object"
      ? preferenceQuery.data.layout_payload
      : {};
  const layoutPayload = buildInventoryWorkspaceLayoutPayload(rawLayoutPayload);
  const activeWorkspaceItem = resolveInventoryWorkspaceItem(location.pathname);

  function persistLayout(nextLayout: { quick_access_paths?: string[]; sidebar_mode?: InventorySidebarMode }) {
    updateWorkbenchPreference.mutate({
      layout_payload: {
        ...rawLayoutPayload,
        quick_access_paths: nextLayout.quick_access_paths ?? layoutPayload.quick_access_paths,
        sidebar_mode: nextLayout.sidebar_mode ?? layoutPayload.sidebar_mode,
      },
    });
  }

  useEffect(() => {
    if (preferenceQuery.isLoading || !activeWorkspaceItem) {
      return;
    }

    if (lastTrackedRouteRef.current === activeWorkspaceItem.to) {
      return;
    }

    lastTrackedRouteRef.current = activeWorkspaceItem.to;

    const nextQuickAccessPaths = buildNextInventoryQuickAccessPaths(activeWorkspaceItem.to, layoutPayload.quick_access_paths);
    if (
      nextQuickAccessPaths.length === layoutPayload.quick_access_paths.length &&
      nextQuickAccessPaths.every((path, index) => path === layoutPayload.quick_access_paths[index])
    ) {
      return;
    }

    updateWorkbenchPreference.mutate({
      layout_payload: {
        ...rawLayoutPayload,
        quick_access_paths: nextQuickAccessPaths,
        sidebar_mode: layoutPayload.sidebar_mode,
      },
    });
  }, [
    activeWorkspaceItem,
    layoutPayload.quick_access_paths,
    layoutPayload.sidebar_mode,
    preferenceQuery.isLoading,
    rawLayoutPayload,
    updateWorkbenchPreference,
  ]);

  return (
    <Stack spacing={2.5} sx={{ height: "100%", minHeight: 0 }}>
      <Box
        sx={{
          alignItems: "stretch",
          display: "grid",
          flex: "1 1 auto",
          gap: 3,
          gridTemplateColumns: {
            xs: "minmax(0, 1fr)",
            md:
              layoutPayload.sidebar_mode === "hidden"
                ? "28px minmax(0, 1fr)"
                : "72px minmax(0, 1fr)",
          },
          minHeight: 0,
        }}
      >
        {layoutPayload.sidebar_mode === "hidden" ? (
          <InventoryHiddenSidebarHandle
            controlsId={inventoryWorkspacePagesNavigationId}
            disabled={updateWorkbenchPreference.isPending}
            onShow={() => persistLayout({ sidebar_mode: "compact" })}
          />
        ) : (
          <InventorySidebar
            activePath={location.pathname}
            isSaving={updateWorkbenchPreference.isPending}
            onHide={() => persistLayout({ sidebar_mode: "hidden" })}
          />
        )}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            minWidth: 0,
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Stack>
  );
}
