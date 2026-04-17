import { useEffect, useRef } from "react";

import { Outlet, useLocation } from "react-router-dom";

import { inventoryWorkspaceItems } from "@/features/inventory/view/inventory-navigation";
import {
  buildInventoryWorkspaceLayoutPayload,
  buildNextInventoryQuickAccessPaths,
  resolveInventoryWorkspaceItem,
} from "@/features/inventory/view/inventory-workspace-preferences";
import { WorkspaceModuleLayout } from "@/shared/components/workspace-module-layout";
import { useWorkspaceLayoutPreference } from "@/shared/hooks/use-workspace-layout-preference";

const inventoryWorkspacePagesNavigationId = "inventory-workspace-pages";

export function InventoryWorkspaceLayout() {
  const location = useLocation();
  const { preferenceQuery, rawLayoutPayload, persistLayout, persistSidebarMode, sidebarMode, updateWorkbenchPreference } =
    useWorkspaceLayoutPreference("inventory");
  const lastTrackedRouteRef = useRef<string | null>(null);
  const layoutPayload = buildInventoryWorkspaceLayoutPayload(rawLayoutPayload);
  const activeWorkspaceItem = resolveInventoryWorkspaceItem(location.pathname);

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

    persistLayout({
      quick_access_paths: nextQuickAccessPaths,
    });
  }, [
    activeWorkspaceItem,
    layoutPayload.quick_access_paths,
    preferenceQuery.isLoading,
    persistLayout,
  ]);

  return (
    <WorkspaceModuleLayout
      ariaLabel="Inventory workspace pages"
      hideLabel="Hide inventory sidebar"
      isSaving={updateWorkbenchPreference.isPending}
      items={inventoryWorkspaceItems}
      mode={sidebarMode}
      navigationId={inventoryWorkspacePagesNavigationId}
      onHide={() => persistSidebarMode("hidden")}
      onShow={() => persistSidebarMode("compact")}
      showLabel="Show inventory sidebar"
    >
      <Outlet />
    </WorkspaceModuleLayout>
  );
}
