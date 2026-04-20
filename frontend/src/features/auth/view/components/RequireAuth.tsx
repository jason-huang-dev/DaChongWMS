import { CircularProgress, Stack } from "@mui/material";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/features/auth/controller/useAuthController";
import { canAccessSurface } from "@/shared/utils/permissions";

export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

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
