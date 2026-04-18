import { Outlet } from "react-router-dom";

import { outboundWorkspaceItems } from "@/features/outbound/view/outbound-navigation";
import { WorkspaceModuleLayout } from "@/shared/components/workspace-module-layout";
import { useWorkspaceLayoutPreference } from "@/shared/hooks/use-workspace-layout-preference";

const outboundWorkspacePagesNavigationId = "outbound-workspace-pages";

export function OutboundWorkspaceLayout() {
  const { persistSidebarMode, sidebarMode, updateWorkbenchPreference } = useWorkspaceLayoutPreference("outbound");

  return (
    <WorkspaceModuleLayout
      ariaLabel="Stock-out workspace pages"
      hideLabel="Hide stock-out sidebar"
      isSaving={updateWorkbenchPreference.isPending}
      items={outboundWorkspaceItems}
      mode={sidebarMode}
      navigationId={outboundWorkspacePagesNavigationId}
      onHide={() => persistSidebarMode("hidden")}
      onShow={() => persistSidebarMode("compact")}
      showLabel="Show stock-out sidebar"
    >
      <Outlet />
    </WorkspaceModuleLayout>
  );
}
