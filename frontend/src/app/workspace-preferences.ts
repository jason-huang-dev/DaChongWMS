import { useEffect } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocation, useMatches, useNavigate } from "react-router-dom";

import { queryClient } from "@/lib/query-client";
import { useTenantScope } from "@/app/scope-context";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";
import type { AuthSession, WorkspaceTabPreferenceRecord, WorkbenchPreferenceRecord } from "@/shared/types/domain";

const accessPreferenceApi = {
  workspaceTabs: "/api/access/workspace-tabs/",
  workspaceTabsSync: "/api/access/workspace-tabs/sync/",
  workbenchPreference: "/api/access/workbench-preferences/current/",
} as const;

interface WorkspaceTabSyncPayload {
  route_key: string;
  route_path: string;
  title: string;
  icon_key?: string;
  is_active?: boolean;
  is_pinned?: boolean;
  state_payload?: Record<string, unknown>;
  context_payload?: Record<string, unknown>;
}

interface WorkbenchPreferencePatchPayload {
  page_key?: string;
  time_window?: string;
  custom_date_from?: string | null;
  custom_date_to?: string | null;
  visible_widget_keys?: string[];
  right_rail_widget_keys?: string[];
  layout_payload?: Record<string, unknown>;
}

function listWorkspaceTabs() {
  return apiGet<PaginatedResponse<WorkspaceTabPreferenceRecord>>(accessPreferenceApi.workspaceTabs, { page: 1, page_size: 20 });
}

function syncWorkspaceTab(payload: WorkspaceTabSyncPayload) {
  return apiPost<WorkspaceTabPreferenceRecord>(accessPreferenceApi.workspaceTabsSync, payload);
}

function activateWorkspaceTab(tabId: number) {
  return apiPost<WorkspaceTabPreferenceRecord>(`${accessPreferenceApi.workspaceTabs}${tabId}/activate/`, {});
}

function closeWorkspaceTab(tabId: number) {
  return apiDelete<void>(`${accessPreferenceApi.workspaceTabs}${tabId}/`);
}

export function getWorkbenchPreferenceQueryKey(activeMembershipId: number | null, pageKey: string) {
  return ["app", "workbench-preference", activeMembershipId, pageKey] as const;
}

export function fetchWorkbenchPreference(
  pageKey: string,
  session?: Pick<AuthSession, "openid" | "operatorId"> & Partial<AuthSession>,
) {
  return apiGet<WorkbenchPreferenceRecord>(accessPreferenceApi.workbenchPreference, { page_key: pageKey }, session);
}

function patchWorkbenchPreference(payload: WorkbenchPreferencePatchPayload) {
  return apiPatch<WorkbenchPreferenceRecord>(accessPreferenceApi.workbenchPreference, payload);
}

export async function prefetchWorkbenchPreference(
  activeMembershipId: number | null,
  pageKey: string,
  session: Pick<AuthSession, "openid" | "operatorId"> & Partial<AuthSession>,
) {
  if (!activeMembershipId) {
    return;
  }

  await queryClient.prefetchQuery({
    queryKey: getWorkbenchPreferenceQueryKey(activeMembershipId, pageKey),
    queryFn: () => fetchWorkbenchPreference(pageKey, session),
  });
}

function buildRouteKey(pathname: string) {
  const segment = pathname.split("/").filter(Boolean)[0];
  return segment || "dashboard";
}

function buildTabTitle(pathname: string, matches: ReturnType<typeof useMatches>) {
  const lastLabeledMatch = [...matches].reverse().find((match) => typeof match.handle === "object" && match.handle && "crumb" in match.handle);
  const crumb = lastLabeledMatch?.handle && typeof lastLabeledMatch.handle === "object" ? (lastLabeledMatch.handle as { crumb?: unknown }).crumb : null;
  if (typeof crumb === "string" && crumb.trim()) {
    return crumb;
  }
  const routeKey = buildRouteKey(pathname);
  return routeKey.charAt(0).toUpperCase() + routeKey.slice(1);
}

export function useWorkspaceTabs() {
  const location = useLocation();
  const matches = useMatches();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { activeMembershipId, activeWarehouseId, company } = useTenantScope();

  const tabsQuery = useQuery({
    queryKey: ["app", "workspace-tabs", activeMembershipId],
    queryFn: listWorkspaceTabs,
    enabled: Boolean(activeMembershipId),
  });

  const syncMutation = useMutation({
    mutationFn: syncWorkspaceTab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app", "workspace-tabs", activeMembershipId] });
    },
  });

  const activateMutation = useMutation({
    mutationFn: activateWorkspaceTab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app", "workspace-tabs", activeMembershipId] });
    },
  });

  const closeMutation = useMutation({
    mutationFn: closeWorkspaceTab,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["app", "workspace-tabs", activeMembershipId] });
    },
  });

  useEffect(() => {
    if (!activeMembershipId) {
      return;
    }
    if (!["/dashboard", "/inventory", "/inventory/balances", "/inbound", "/outbound", "/transfers", "/returns", "/counting", "/automation", "/integrations", "/finance", "/security", "/mfa/enroll"].some((path) => location.pathname === path || location.pathname.startsWith(`${path}/`))) {
      return;
    }
    syncMutation.mutate({
      route_key: buildRouteKey(location.pathname),
      route_path: location.pathname,
      title: buildTabTitle(location.pathname, matches),
      is_active: true,
      context_payload: {
        company_id: company?.id ?? null,
        warehouse_id: activeWarehouseId,
      },
    });
    // The tab state should track route changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMembershipId, activeWarehouseId, company?.id, location.pathname]);

  return {
    tabsQuery,
    tabs: tabsQuery.data?.results ?? [],
    activateTab: async (tabId: number, routePath: string) => {
      await activateMutation.mutateAsync(tabId);
      navigate(routePath);
    },
    closeTab: async (tabId: number, routePath: string) => {
      await closeMutation.mutateAsync(tabId);
      if (location.pathname === routePath) {
        navigate("/dashboard");
      }
    },
    isClosingTab: closeMutation.isPending,
  };
}

export function useWorkbenchPreference(pageKey: string, options?: { enabled?: boolean }) {
  const queryClient = useQueryClient();
  const { activeMembershipId } = useTenantScope();
  const enabled = options?.enabled ?? true;
  const queryKey = getWorkbenchPreferenceQueryKey(activeMembershipId, pageKey);

  const query = useQuery({
    queryKey,
    queryFn: () => fetchWorkbenchPreference(pageKey),
    enabled: Boolean(activeMembershipId) && enabled,
  });

  const updateMutation = useMutation({
    mutationFn: (payload: WorkbenchPreferencePatchPayload) => patchWorkbenchPreference({ page_key: pageKey, ...payload }),
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });

      const previousPreference = queryClient.getQueryData<WorkbenchPreferenceRecord>(queryKey);
      if (previousPreference) {
        queryClient.setQueryData<WorkbenchPreferenceRecord>(queryKey, {
          ...previousPreference,
          ...payload,
          layout_payload: payload.layout_payload
            ? {
                ...previousPreference.layout_payload,
                ...payload.layout_payload,
              }
            : previousPreference.layout_payload,
        });
      }

      return { previousPreference };
    },
    onError: (_error, _payload, context) => {
      if (context?.previousPreference) {
        queryClient.setQueryData(queryKey, context.previousPreference);
      }
    },
    onSuccess: async (nextPreference) => {
      queryClient.setQueryData(queryKey, nextPreference);
      await queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    preferenceQuery: query,
    updateWorkbenchPreference: updateMutation,
  };
}
