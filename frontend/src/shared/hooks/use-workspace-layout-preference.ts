import { useCallback, useMemo } from "react";

import { useWorkbenchPreference } from "@/app/workspace-preferences";

export type WorkspaceSidebarMode = "compact" | "hidden";

function extractLayoutPayload(layoutPayload: unknown) {
  return layoutPayload && typeof layoutPayload === "object" ? layoutPayload as Record<string, unknown> : {};
}

export function resolveWorkspaceSidebarMode(layoutPayload: Record<string, unknown>): WorkspaceSidebarMode {
  return layoutPayload.sidebar_mode === "hidden" ? "hidden" : "compact";
}

export function useWorkspaceLayoutPreference(pageKey: string) {
  const { preferenceQuery, updateWorkbenchPreference } = useWorkbenchPreference(pageKey);
  const rawLayoutPayload = useMemo(() => extractLayoutPayload(preferenceQuery.data?.layout_payload), [preferenceQuery.data?.layout_payload]);
  const sidebarMode = useMemo(() => resolveWorkspaceSidebarMode(rawLayoutPayload), [rawLayoutPayload]);

  const persistLayout = useCallback(
    (nextLayoutPayload: Record<string, unknown>) => {
      updateWorkbenchPreference.mutate({
        layout_payload: {
          ...rawLayoutPayload,
          ...nextLayoutPayload,
        },
      });
    },
    [rawLayoutPayload, updateWorkbenchPreference],
  );

  const persistSidebarMode = useCallback(
    (nextSidebarMode: WorkspaceSidebarMode) => {
      persistLayout({ sidebar_mode: nextSidebarMode });
    },
    [persistLayout],
  );

  return {
    preferenceQuery,
    updateWorkbenchPreference,
    rawLayoutPayload,
    persistLayout,
    persistSidebarMode,
    sidebarMode,
  };
}
