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
import { alpha } from "@mui/material/styles";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { brandColors, brandGradients, brandShadows } from "@/app/brand";
import { navigationItems } from "@/app/layout/navigation-items";
import { RouteBreadcrumbs } from "@/app/layout/route-breadcrumbs";
import { useAuth } from "@/features/auth/controller/useAuthController";
import { BrandLogo } from "@/shared/components/brand-logo";
import { hasAnyRole } from "@/shared/utils/permissions";

const drawerWidth = 264;

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);

  const filteredItems = useMemo(
    () => navigationItems.filter((item) => hasAnyRole(session, item.roles)),
    [session],
  );

  const drawerContent = (
    <Box
      sx={{
        background: brandGradients.shellDrawer,
        color: brandColors.inkSoft,
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <Toolbar sx={{ alignItems: "flex-start", px: 3, py: 3 }}>
        <Stack>
          <BrandLogo kind="lockup" sx={{ mb: 1, width: 150 }} variant="gold" />
          <Typography color={alpha(brandColors.inkSoft, 0.7)} variant="body2">
            Operator console
          </Typography>
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
                "& .MuiListItemText-primary": {
                  fontWeight: selected ? 700 : 500,
                },
                "&.Mui-selected": {
                  backgroundColor: alpha(brandColors.gold, 0.12),
                  border: `1px solid ${alpha(brandColors.gold, 0.18)}`,
                  boxShadow: brandShadows.glow,
                  color: brandColors.goldLight,
                },
                "&.Mui-selected:hover": {
                  backgroundColor: alpha(brandColors.gold, 0.16),
                },
                "&:hover": {
                  backgroundColor: alpha(brandColors.gold, 0.08),
                },
                borderRadius: 2.5,
                color: selected ? brandColors.goldLight : alpha(brandColors.inkSoft, 0.86),
                mb: 0.75,
              }}
            >
              <ListItemIcon>
                <Icon color={selected ? "primary" : "inherit"} />
              </ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      <AppBar color="inherit" elevation={0} position="fixed" sx={{ ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <RouteBreadcrumbs />
          </Box>
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
                {session?.operatorRole}
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
              Sign out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        onClose={() => setMobileOpen(false)}
        open={mobileOpen}
        sx={{
          "& .MuiDrawer-paper": {
            background: brandGradients.shellDrawer,
            boxSizing: "border-box",
            width: drawerWidth,
          },
          display: { md: "none" },
        }}
        variant="temporary"
      >
        {drawerContent}
      </Drawer>
      <Drawer
        open
        sx={{
          "& .MuiDrawer-paper": {
            background: brandGradients.shellDrawer,
            boxSizing: "border-box",
            width: drawerWidth,
          },
          display: { xs: "none", md: "block" },
        }}
        variant="permanent"
      >
        {drawerContent}
      </Drawer>
      <Box component="main" sx={{ flexGrow: 1, ml: { md: `${drawerWidth}px` }, p: 3, pt: { xs: 11, md: 12 } }}>
        <Outlet />
      </Box>
    </Box>
  );
}
