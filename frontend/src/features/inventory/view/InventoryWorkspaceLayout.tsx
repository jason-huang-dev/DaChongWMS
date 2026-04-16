import { useEffect, useRef } from "react";

import { Box, Stack } from "@mui/material";
import { Outlet, useLocation } from "react-router-dom";

import { useWorkbenchPreference } from "@/app/workspace-preferences";
import { inventoryWorkspaceItems } from "@/features/inventory/view/inventory-navigation";
import {
  buildInventoryWorkspaceLayoutPayload,
  buildNextInventoryQuickAccessPaths,
  type InventorySidebarMode,
  resolveInventoryWorkspaceItem,
} from "@/features/inventory/view/inventory-workspace-preferences";
import {
  WorkspaceIconNav,
  workspaceIconNavCompactWidth,
  workspaceIconNavHiddenWidth,
} from "@/shared/components/workspace-icon-nav";

const inventoryWorkspacePagesNavigationId = "inventory-workspace-pages";

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
                ? `${workspaceIconNavHiddenWidth}px minmax(0, 1fr)`
                : `${workspaceIconNavCompactWidth}px minmax(0, 1fr)`,
          },
          minHeight: 0,
        }}
      >
        <WorkspaceIconNav
          ariaLabel="Inventory workspace pages"
          hideLabel="Hide inventory sidebar"
          isSaving={updateWorkbenchPreference.isPending}
          items={inventoryWorkspaceItems}
          mode={layoutPayload.sidebar_mode}
          navigationId={inventoryWorkspacePagesNavigationId}
          onHide={() => persistLayout({ sidebar_mode: "hidden" })}
          onShow={() => persistLayout({ sidebar_mode: "compact" })}
          showLabel="Show inventory sidebar"
        />
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
