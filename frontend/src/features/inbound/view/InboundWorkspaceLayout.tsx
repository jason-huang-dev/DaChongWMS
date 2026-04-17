import { Outlet } from "react-router-dom";

import { inboundWorkspaceItems } from "@/features/inbound/view/inbound-navigation";
import { WorkspaceModuleLayout } from "@/shared/components/workspace-module-layout";
import { useWorkspaceLayoutPreference } from "@/shared/hooks/use-workspace-layout-preference";

const inboundWorkspacePagesNavigationId = "inbound-workspace-pages";

export function InboundWorkspaceLayout() {
  const { persistSidebarMode, sidebarMode, updateWorkbenchPreference } = useWorkspaceLayoutPreference("inbound");

  return (
    <WorkspaceModuleLayout
      ariaLabel="Stock-in workspace pages"
      hideLabel="Hide stock-in sidebar"
      isSaving={updateWorkbenchPreference.isPending}
      items={inboundWorkspaceItems}
      mode={sidebarMode}
      navigationId={inboundWorkspacePagesNavigationId}
      onHide={() => persistSidebarMode("hidden")}
      onShow={() => persistSidebarMode("compact")}
      showLabel="Show stock-in sidebar"
    >
      <Outlet />
    </WorkspaceModuleLayout>
  );
}
