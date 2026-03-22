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

import { useWorkspaceTabs } from "@/app/workspace-preferences";
import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import { ModuleTopNav } from "@/app/layout/module-top-nav";
import { navigationItems } from "@/app/layout/navigation-items";
import { RouteBreadcrumbs } from "@/app/layout/route-breadcrumbs";
import { WorkspaceTabsBar } from "@/app/layout/workspace-tabs-bar";
import { useTenantScope } from "@/app/scope-context";
import { useI18n } from "@/app/ui-preferences";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { BrandLogo } from "@/shared/components/brand-logo";
import { UiPreferencesControls } from "@/shared/components/ui-preferences-controls";
import { WorkspaceContextSwitcher } from "@/shared/components/workspace-context-switcher";
import { hasAnyRole } from "@/shared/utils/permissions";

const mobileDrawerWidth = 300;

export function AppShell() {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const location = useLocation();
  const navigate = useNavigate();
  const { t, translateText } = useI18n();
  const { session, logout } = useAuth();
  const { company, memberships, activeMembershipId, switchMembership, warehouses, activeWarehouseId, setActiveWarehouseId } = useTenantScope();
  const { tabs, activateTab, closeTab, isClosingTab } = useWorkspaceTabs();
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
          ? "linear-gradient(180deg, #120d09 0%, #1b120c 52%, #23150d 100%)"
          : brandGradients.shellDrawer,
        color: brandColors.inkSoft,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Toolbar sx={{ alignItems: "flex-start", px: 3, py: 3 }}>
        <Stack spacing={1.5} sx={{ width: "100%" }}>
          <BrandLogo alt={t("ui.brandLogoAlt")} kind="lockup" sx={{ width: 150 }} variant="gold" />
          <Typography color={alpha(brandColors.inkSoft, 0.7)} variant="body2">
            {t("shell.multiTenantTagline")}
          </Typography>
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
      <Divider sx={{ borderColor: alpha(brandColors.gold, 0.16) }} />
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
                  color: selected ? brandColors.goldLight : alpha(brandColors.inkSoft, 0.76),
                  minWidth: 40,
                },
                "&.Mui-selected": {
                  backgroundColor: alpha(brandColors.gold, 0.12),
                  border: `1px solid ${alpha(brandColors.gold, 0.18)}`,
                  boxShadow: brandShadows.glow,
                  color: brandColors.goldLight,
                },
                borderRadius: 2.5,
                color: selected ? brandColors.goldLight : alpha(brandColors.inkSoft, 0.86),
                mb: 0.75,
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
    <Box sx={{ minHeight: "100vh" }}>
      <AppBar color="inherit" elevation={0} position="fixed">
        <Toolbar sx={{ gap: 2, minHeight: 72 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { lg: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Stack direction="row" spacing={1.5} sx={{ minWidth: 0, width: { xs: "auto", lg: 220 } }}>
            <BrandLogo alt={t("ui.brandLogoAlt")} kind="lockup" sx={{ width: 150 }} variant="gold" />
          </Stack>
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: { xs: "none", xl: "block" } }}>
            <WorkspaceContextSwitcher
              activeMembershipId={activeMembershipId}
              activeWarehouseId={activeWarehouseId}
              company={company}
              memberships={memberships}
              onMembershipChange={switchMembership}
              onWarehouseChange={setActiveWarehouseId}
              warehouses={warehouses}
            />
          </Box>
          <UiPreferencesControls compact />
          <Stack alignItems="center" direction="row" onClick={(event) => setMenuAnchor(event.currentTarget)} spacing={1.5} sx={{ cursor: "pointer" }}>
            <Avatar
              sx={{
                backgroundImage: brandGradients.goldAccent,
                boxShadow: brandShadows.glow,
                color: brandColors.ink,
                height: 36,
                width: 36,
              }}
            >
              {session?.operatorName?.slice(0, 1) ?? "U"}
            </Avatar>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <Typography variant="body2">{session?.operatorName}</Typography>
              <Typography color="text.secondary" variant="caption">
                {session?.operatorRole ? translateText(session.operatorRole) : session?.operatorRole}
              </Typography>
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
        <Box sx={{ borderTop: `1px solid ${alpha(brandColors.goldDark, 0.12)}`, px: { xs: 2, lg: 3 }, py: 1 }}>
          <Stack spacing={1.25}>
            <Box sx={{ display: { xs: "none", lg: "block" }, minWidth: 0 }}>
              <ModuleTopNav activePath={location.pathname} items={filteredItems} onNavigate={navigate} />
            </Box>
            <Stack alignItems={{ sm: "center" }} direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.25}>
              <Box sx={{ minWidth: 0, overflow: "hidden" }}>
                <RouteBreadcrumbs />
              </Box>
              <Box sx={{ display: { xs: "block", xl: "none" }, width: { xs: "100%", sm: "auto" } }}>
                <WorkspaceContextSwitcher
                  activeMembershipId={activeMembershipId}
                  activeWarehouseId={activeWarehouseId}
                  company={company}
                  memberships={memberships}
                  onMembershipChange={switchMembership}
                  onWarehouseChange={setActiveWarehouseId}
                  warehouses={warehouses}
                />
              </Box>
            </Stack>
            <WorkspaceTabsBar activePath={location.pathname} isClosingTab={isClosingTab} onActivate={activateTab} onClose={closeTab} tabs={tabs} />
          </Stack>
        </Box>
      </AppBar>
      <Drawer
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        sx={{
          "& .MuiDrawer-paper": {
            background: brandGradients.shellDrawer,
            boxSizing: "border-box",
            width: mobileDrawerWidth,
          },
          display: { lg: "none" },
        }}
        variant="temporary"
      >
        {drawerContent}
      </Drawer>
      <Box component="main" sx={{ p: 3, pt: { xs: 24, md: 22 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
