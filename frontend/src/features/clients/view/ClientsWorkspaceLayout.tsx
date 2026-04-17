import { Outlet } from "react-router-dom";

import { clientWorkspaceItems } from "@/features/clients/view/client-navigation";
import { WorkspaceModuleLayout } from "@/shared/components/workspace-module-layout";
import { useWorkspaceLayoutPreference } from "@/shared/hooks/use-workspace-layout-preference";

const clientsWorkspacePagesNavigationId = "clients-workspace-pages";

export function ClientsWorkspaceLayout() {
  const { persistSidebarMode, sidebarMode, updateWorkbenchPreference } = useWorkspaceLayoutPreference("clients");

  return (
    <WorkspaceModuleLayout
      ariaLabel="Client workspace pages"
      hideLabel="Hide client sidebar"
      isSaving={updateWorkbenchPreference.isPending}
      items={clientWorkspaceItems}
      mode={sidebarMode}
      navigationId={clientsWorkspacePagesNavigationId}
      onHide={() => persistSidebarMode("hidden")}
      onShow={() => persistSidebarMode("compact")}
      showLabel="Show client sidebar"
    >
      <Outlet />
    </WorkspaceModuleLayout>
  );
}
