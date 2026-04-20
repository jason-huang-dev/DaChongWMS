import { dashboardOperationsPermissionGroups, feesAccessPermissionCodes } from "@/app/access";
import type { AuthSession } from "@/shared/types/domain";
import { hasAnyPermission, hasEveryPermissionGroup } from "@/shared/utils/permissions";

export function getDashboardAccess(session: AuthSession | null) {
  return {
    canViewOps: hasEveryPermissionGroup(session, dashboardOperationsPermissionGroups),
    canViewFinance: hasAnyPermission(session, feesAccessPermissionCodes),
  };
}
