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
import { Outlet, useLocation, useNavigate } from "react-router-dom";

import { navigationItems } from "@/app/layout/navigation-items";
import { RouteBreadcrumbs } from "@/app/layout/route-breadcrumbs";
import { useAuth } from "@/features/auth/controller/useAuthController";
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
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar>
        <Stack>
          <Typography variant="h6">DaChongWMS</Typography>
          <Typography color="text.secondary" variant="body2">
            Operator console
          </Typography>
        </Stack>
      </Toolbar>
      <Divider />
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
              sx={{ borderRadius: 2, mb: 0.5 }}
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
      <AppBar color="inherit" elevation={0} position="fixed" sx={{ borderBottom: 1, borderColor: "divider", ml: { md: `${drawerWidth}px` }, width: { md: `calc(100% - ${drawerWidth}px)` } }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={() => setMobileOpen(true)} sx={{ display: { md: "none" } }}>
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1 }}>
            <RouteBreadcrumbs />
          </Box>
          <Stack alignItems="center" direction="row" onClick={(event) => setMenuAnchor(event.currentTarget)} spacing={1.5} sx={{ cursor: "pointer" }}>
            <Avatar sx={{ bgcolor: "primary.main", height: 36, width: 36 }}>{session?.operatorName?.slice(0, 1) ?? "U"}</Avatar>
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
          display: { md: "none" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
        }}
        variant="temporary"
      >
        {drawerContent}
      </Drawer>
      <Drawer
        open
        sx={{
          display: { xs: "none", md: "block" },
          "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth },
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
