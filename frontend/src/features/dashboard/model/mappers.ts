import type { AuthSession } from "@/shared/types/domain";
import { hasAnyRole } from "@/shared/utils/permissions";

export function getDashboardAccess(session: AuthSession | null) {
  return {
    canViewOps: hasAnyRole(session, ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]),
    canViewFinance: hasAnyRole(session, ["Manager", "Supervisor", "Finance"]),
  };
}
