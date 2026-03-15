import type { AuthSession } from "@/shared/types/domain";
import { hasAnyRole } from "@/shared/utils/permissions";

import type { InventoryBalanceRecord } from "./types";

export function getDashboardAccess(session: AuthSession | null) {
  return {
    canViewOps: hasAnyRole(session, ["Manager", "Supervisor", "Inbound", "Outbound", "StockControl"]),
    canViewFinance: hasAnyRole(session, ["Manager", "Supervisor", "Finance"]),
  };
}

export function sumVisibleOnHand(balances: InventoryBalanceRecord[]) {
  return balances.reduce((sum, balance) => sum + Number(balance.on_hand_qty), 0);
}
