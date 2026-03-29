import { useMemo, useState } from "react";

import MenuIcon from "@mui/icons-material/Menu";
import {
  AppBar,
  Avatar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { brandColors, brandGradients, brandMotion, brandShadows, brandStatusColors } from "@/app/brand";
import { ModuleTopNav } from "@/app/layout/module-top-nav";
import { navigationItems } from "@/app/layout/navigation-items";
import { RouteBreadcrumbs } from "@/app/layout/route-breadcrumbs";
import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { BrandLogo } from "@/shared/components/brand-logo";
import { UiPreferencesControls } from "@/shared/components/ui-preferences-controls";
import { WorkspaceContextSwitcher } from "@/shared/components/workspace-context-switcher";
import { hasAnyRole } from "@/shared/utils/permissions";

const mobileDrawerWidth = 300;
const shellNavPillHeight = 32;

export function AppShell() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const { t, translateText } = useI18n();
  const { session, logout } = useAuth();
  const { company, memberships, activeMembershipId, switchMembership, warehouses, activeWarehouseId, setActiveWarehouseId } = useTenantScope();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const filteredItems = useMemo(
    () => navigationItems.filter((item) => hasAnyRole(session, item.roles)),
    [session],
  );

  const drawerContent = (
    <Box
      sx={{
        background: isDark
          ? brandGradients.shellDrawerDark
          : brandGradients.shellDrawerLight,
        color: theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Toolbar sx={{ alignItems: "flex-start", minHeight: 64, px: 2.5, py: 2 }}>
        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <BrandLogo alt={t("ui.brandLogoAlt")} kind="lockup" sx={{ maxWidth: 50, width: "100%" }} variant="gold" />
          <Typography color="text.secondary" sx={{ lineHeight: 1.35 }} variant="caption">
            {t("shell.multiTenantTagline")}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap" }}>
            <Box
              sx={{
                alignItems: "center",
                backgroundColor: alpha(brandColors.accent, isDark ? 0.14 : 0.1),
                border: `1px solid ${alpha(brandColors.accentStrong, isDark ? 0.3 : 0.18)}`,
                borderRadius: 999,
                color: theme.palette.text.primary,
                display: "inline-flex",
                gap: 0.75,
                px: 0.5,
                py: 0.2,
              }}
            >
              <Box
                sx={{
                  backgroundColor: isDark ? brandStatusColors.success.dark : brandStatusColors.success.light,
                  borderRadius: "50%",
                  boxShadow: `0 0 0 3px ${alpha(isDark ? brandStatusColors.success.dark : brandStatusColors.success.light, 0.16)}`,
                  height: 6,
                  width: 6,
                }}
              />
              <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Active Workspace
              </Typography>
            </Box>
          </Stack>
          <WorkspaceContextSwitcher
            activeMembershipId={activeMembershipId}
            activeWarehouseId={activeWarehouseId}
            company={company}
            memberships={memberships}
            onMembershipChange={switchMembership}
            onWarehouseChange={setActiveWarehouseId}
            warehouses={warehouses}
          />
        </Stack>
      </Toolbar>
      <Divider sx={{ borderColor: alpha(theme.palette.divider, 0.9) }} />
      <List sx={{ flexGrow: 1, px: 1.5, py: 2 }}>
        {filteredItems.map((item) => {
          const Icon = item.icon;
          const selected = location.pathname === item.path || location.pathname.startsWith(`${item.path}/`);
          return (
            <ListItemButton
              key={item.path}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              selected={selected}
              sx={{
                "& .MuiListItemIcon-root": {
                  color: selected ? brandColors.accent : alpha(theme.palette.text.primary, 0.68),
                  minWidth: 40,
                },
                "&.Mui-selected": {
                  backgroundColor: alpha(brandColors.accent, isDark ? 0.14 : 0.1),
                  border: `1px solid ${alpha(brandColors.accentStrong, isDark ? 0.28 : 0.18)}`,
                  boxShadow: `inset 3px 0 0 ${brandColors.accent}`,
                  color: theme.palette.text.primary,
                },
                "&::before": {
                  backgroundColor: selected ? brandColors.accent : "transparent",
                  borderRadius: 999,
                  content: "\"\"",
                  height: 18,
                  left: 8,
                  position: "absolute",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: 3,
                },
                "&:hover": {
                  backgroundColor: alpha(theme.palette.text.primary, isDark ? 0.06 : 0.04),
                },
                borderRadius: 2.5,
                color: selected ? theme.palette.text.primary : alpha(theme.palette.text.primary, 0.82),
                mb: 0.75,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <ListItemIcon>
                <Icon color={selected ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText primary={translateText(item.label)} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", minHeight: "100dvh", width: "100%" }}>
      <AppBar color="inherit" elevation={0} position="sticky">
        <Toolbar sx={{ gap: 1, minHeight: { xs: 50, md: 54 }, px: { xs: 1.25, lg: 2 } }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { lg: "none" } }}>
            <MenuIcon sx={{ fontSize: 28 }} />
          </IconButton>
          <Box sx={{ alignItems: "center", display: "flex", flex: "0 0 auto", minWidth: 0 }}>
            <BrandLogo
              alt={t("ui.brandLogoAlt")}
              kind="lockup"
              sx={{ maxWidth: { xs: 25, md: 50 }, width: "100%" }}
              variant="gold"
            />
          </Box>
          <Box
            data-testid="navbar-context-switcher"
            sx={{
              alignItems: "center",
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.62 : 0.74),
              border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
              borderRadius: 999,
              display: { xs: "none", md: "flex" },
              flex: "0 1 auto",
              gap: 0.625,
              height: shellNavPillHeight,
              maxWidth: { md: 240, lg: 280, xl: 320 },
              minHeight: shellNavPillHeight,
              minWidth: 0,
              px: 0.5,
              py: 0.175,
            }}
          >
            <Box sx={{ flex: "0 1 auto", minWidth: 0 }}>
              <WorkspaceContextSwitcher
                activeMembershipId={activeMembershipId}
                activeWarehouseId={activeWarehouseId}
                company={company}
                compact
                memberships={memberships}
                onMembershipChange={switchMembership}
                onWarehouseChange={setActiveWarehouseId}
                warehouses={warehouses}
              />
            </Box>
          </Box>
          <Box sx={{ display: { xs: "none", md: "block" }, flexGrow: 1, minWidth: 0 }}>
            <ModuleTopNav activePath={location.pathname} items={filteredItems} onNavigate={navigate} />
          </Box>
          <Box sx={{ display: { xs: "block", md: "none" }, flexGrow: 1 }} />
          <Box
            data-testid="navbar-preferences-pill"
            sx={{
              alignItems: "center",
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.62 : 0.74),
              border: `1px solid ${alpha(theme.palette.divider, 0.72)}`,
              borderRadius: 999,
              display: "flex",
              gap: 0.75,
              height: shellNavPillHeight,
              minHeight: shellNavPillHeight,
              px: 0.25,
              py: 0.175,
            }}
          >
            <UiPreferencesControls compact />
          </Box>
          <Stack
            alignItems="center"
            data-testid="navbar-profile-pill"
            direction="row"
            onClick={(event) => setMenuAnchor(event.currentTarget)}
            spacing={1.5}
            sx={{
              backgroundColor: alpha(theme.palette.background.paper, isDark ? 0.66 : 0.78),
              border: `1px solid ${alpha(theme.palette.divider, 0.76)}`,
              borderRadius: 999,
              cursor: "pointer",
              height: shellNavPillHeight,
              minHeight: shellNavPillHeight,
              px: 0.375,
              py: 0.175,
              transition: [
                `background-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `border-color ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
                `box-shadow ${brandMotion.duration.standard} ${brandMotion.easing.standard}`,
                `transform ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
              ].join(", "),
              "&:hover": {
                boxShadow: isDark ? brandShadows.floatingDark : brandShadows.floatingLight,
                transform: "translateY(-1px)",
              },
            }}
          >
            <Avatar
              sx={{
                backgroundImage: brandGradients.accent,
                boxShadow: brandShadows.accentGlow,
                color: brandColors.textPrimaryLight,
                fontSize: 12,
                height: 24,
                width: 24,
              }}
            >
              {session?.operatorName?.slice(0, 1) ?? "U"}
            </Avatar>
            <Box sx={{ display: { xs: "none", lg: "block" } }}>
              <Typography sx={{ fontSize: 12 }} variant="body2">{session?.operatorName}</Typography>
              <Stack alignItems="center" direction="row" spacing={0.75}>
                <Typography color="text.secondary" sx={{ fontSize: 10 }} variant="caption">
                  {session?.operatorRole ? translateText(session.operatorRole) : session?.operatorRole}
                </Typography>
                <Box
                  sx={{
                    backgroundColor: isDark ? brandStatusColors.success.dark : brandStatusColors.success.light,
                    borderRadius: "50%",
                    boxShadow: `0 0 0 3px ${alpha(
                      isDark ? brandStatusColors.success.dark : brandStatusColors.success.light,
                      0.14,
                    )}`,
                    height: 6,
                    width: 6,
                  }}
                />
              </Stack>
            </Box>
          </Stack>
          <Menu anchorEl={menuAnchor} onClose={() => setMenuAnchor(null)} open={Boolean(menuAnchor)}>
            <MenuItem
              onClick={() => {
                setMenuAnchor(null);
                logout();
                navigate("/login", { replace: true });
              }}
            >
              {t("shell.signOut")}
            </MenuItem>
          </Menu>
        </Toolbar>
        <Box
          data-testid="top-info-bar"
          sx={{
            background: isDark
              ? brandGradients.topRailDark
              : brandGradients.topRailLight,
            borderTop: `1px solid ${alpha(brandColors.accentStrong, 0.12)}`,
            height: 6,
            maxHeight: 6,
            minHeight: 6,
          }}
        />
      </AppBar>
      <Drawer
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        sx={{
          "& .MuiDrawer-paper": {
            background: isDark ? brandGradients.shellDrawerDark : brandGradients.shellDrawerLight,
            boxSizing: "border-box",
            width: mobileDrawerWidth,
          },
          display: { lg: "none" },
        }}
        variant="temporary"
      >
        {drawerContent}
      </Drawer>
      <Box
        component="main"
        sx={{
          boxSizing: "border-box",
          flex: "1 1 auto",
          overflowX: "hidden",
          p: { xs: 1.25, md: 1.5 },
          transition: `padding ${brandMotion.duration.fast} ${brandMotion.easing.standard}`,
          width: "100%",
        }}
      >
        <Stack spacing={0.75} sx={{ mb: 1.75 }}>
          <Box sx={{ minWidth: 0 }}>
            <RouteBreadcrumbs />
          </Box>
        </Stack>
        <Outlet />
      </Box>
    </Box>
  );
}
