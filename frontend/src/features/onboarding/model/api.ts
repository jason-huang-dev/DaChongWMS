import { apiGet, apiPost } from "@/lib/http";

import type { WorkspaceOnboardingStatus, WorkspaceSetupPayload, WorkspaceSetupResult } from "./types";

export async function fetchWorkspaceOnboardingStatus() {
  return apiGet<WorkspaceOnboardingStatus>("/api/v1/auth/onboarding/workspace-setup/");
}

export async function submitWorkspaceSetup(payload: WorkspaceSetupPayload) {
  return apiPost<WorkspaceSetupResult>("/api/v1/auth/onboarding/workspace-setup/", payload);
}
