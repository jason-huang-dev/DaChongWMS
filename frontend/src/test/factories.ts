import {
  clientsAccessPermissionCodes,
  countingAccessPermissionCodes,
  feesAccessPermissionCodes,
  inboundAccessPermissionCodes,
  inventoryAccessPermissionCodes,
  logisticsAccessPermissionCodes,
  outboundAccessPermissionCodes,
  productsAccessPermissionCodes,
  reportingAccessPermissionCodes,
  returnsAccessPermissionCodes,
  securityManagementPermissionCodes,
  transfersAccessPermissionCodes,
  workOrdersAccessPermissionCodes,
} from "@/app/access";
import type { PaginatedResponse } from "@/shared/types/api";
import type { StaffRecord } from "@/shared/types/domain";

function resolvePermissionCodesForRole(role: string) {
  switch (role) {
    case "Manager":
    case "Supervisor":
      return [
        ...clientsAccessPermissionCodes,
        ...countingAccessPermissionCodes,
        ...feesAccessPermissionCodes,
        ...inboundAccessPermissionCodes,
        ...inventoryAccessPermissionCodes,
        ...logisticsAccessPermissionCodes,
        ...outboundAccessPermissionCodes,
        ...productsAccessPermissionCodes,
        ...reportingAccessPermissionCodes,
        ...returnsAccessPermissionCodes,
        ...securityManagementPermissionCodes,
        ...transfersAccessPermissionCodes,
        ...workOrdersAccessPermissionCodes,
      ];
    case "Finance":
      return [...feesAccessPermissionCodes, ...reportingAccessPermissionCodes];
    case "Inbound":
      return [...inboundAccessPermissionCodes];
    case "Outbound":
      return [...outboundAccessPermissionCodes];
    case "StockControl":
      return [...inventoryAccessPermissionCodes, ...countingAccessPermissionCodes, ...transfersAccessPermissionCodes];
    default:
      return [];
  }
}

export function buildStaffRecord(
  role: string,
  overrides: Partial<StaffRecord> = {},
): StaffRecord {
  return {
    id: 11,
    staff_name: "Route Tester",
    staff_type: role,
    permission_codes: resolvePermissionCodesForRole(role),
    check_code: 8888,
    create_time: "2026-03-14 09:00:00",
    update_time: "2026-03-14 09:00:00",
    error_check_code_counter: 0,
    is_lock: false,
    ...overrides,
  };
}

export function buildPaginatedResponse<TRecord>(
  results: TRecord[],
): PaginatedResponse<TRecord> {
  return {
    count: results.length,
    next: null,
    previous: null,
    results,
  };
}
