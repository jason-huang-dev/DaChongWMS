import { CircularProgress, Stack } from "@mui/material";
import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { fetchWorkspaceOnboardingStatus } from "@/features/onboarding/model/api";
import { canAccessSurface } from "@/shared/utils/permissions";

const onboardingPath = "/onboarding/warehouse-setup";
const onboardingBypassPaths = new Set([onboardingPath, "/mfa/enroll"]);

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();
  const onboardingQuery = useQuery({
    queryKey: ["auth", "onboarding", "workspace-setup"],
    queryFn: fetchWorkspaceOnboardingStatus,
    enabled: status === "authenticated",
    retry: false,
  });

  if (status === "loading") {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (status === "anonymous") {
    return <Navigate replace state={{ from: location }} to="/login" />;
  }

  const isOnboardingBypassPath = onboardingBypassPaths.has(location.pathname);
  if (onboardingQuery.isLoading && !isOnboardingBypassPath) {
    return (
      <Stack alignItems="center" justifyContent="center" minHeight="100vh">
        <CircularProgress />
      </Stack>
    );
  }

  if (onboardingQuery.data?.is_required && !isOnboardingBypassPath) {
    return <Navigate replace state={{ from: location }} to={onboardingPath} />;
  }

  return <Outlet />;
}

export function RequirePermissions({
  permissionCodes,
  permissionGroups,
}: {
  permissionCodes?: readonly string[];
  permissionGroups?: readonly (readonly string[])[];
}) {
  const { session } = useAuth();

  if (!canAccessSurface(session, { permissionCodes, permissionGroups })) {
    return <Navigate replace to="/not-authorized" />;
  }

  return <Outlet />;
}
