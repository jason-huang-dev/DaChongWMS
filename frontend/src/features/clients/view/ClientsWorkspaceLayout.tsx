import { Box, Stack } from "@mui/material";
import { Outlet } from "react-router-dom";

import { useWorkbenchPreference } from "@/app/workspace-preferences";
import { clientWorkspaceItems } from "@/features/clients/view/client-navigation";
import {
  WorkspaceIconNav,
  workspaceIconNavCompactWidth,
  workspaceIconNavHiddenWidth,
} from "@/shared/components/workspace-icon-nav";

const clientsWorkspacePagesNavigationId = "clients-workspace-pages";

function resolveClientsSidebarMode(layoutPayload: Record<string, unknown>) {
  return layoutPayload.sidebar_mode === "hidden" ? "hidden" : "compact";
}

export function ClientsWorkspaceLayout() {
  const { preferenceQuery, updateWorkbenchPreference } = useWorkbenchPreference("clients");

  const rawLayoutPayload =
    preferenceQuery.data?.layout_payload && typeof preferenceQuery.data.layout_payload === "object"
      ? preferenceQuery.data.layout_payload
      : {};
  const sidebarMode = resolveClientsSidebarMode(rawLayoutPayload);

  function persistLayout(nextSidebarMode: "compact" | "hidden") {
    updateWorkbenchPreference.mutate({
      layout_payload: {
        ...rawLayoutPayload,
        sidebar_mode: nextSidebarMode,
      },
    });
  }

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
              sidebarMode === "hidden"
                ? `${workspaceIconNavHiddenWidth}px minmax(0, 1fr)`
                : `${workspaceIconNavCompactWidth}px minmax(0, 1fr)`,
          },
          minHeight: 0,
        }}
      >
        <WorkspaceIconNav
          ariaLabel="Client workspace pages"
          hideLabel="Hide client sidebar"
          isSaving={updateWorkbenchPreference.isPending}
          items={clientWorkspaceItems}
          mode={sidebarMode}
          navigationId={clientsWorkspacePagesNavigationId}
          onHide={() => persistLayout("hidden")}
          onShow={() => persistLayout("compact")}
          showLabel="Show client sidebar"
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
