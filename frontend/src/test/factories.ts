import type { PaginatedResponse } from "@/shared/types/api";
import type { StaffRecord } from "@/shared/types/domain";

export function buildStaffRecord(
  role: string,
  overrides: Partial<StaffRecord> = {},
): StaffRecord {
  return {
    id: 11,
    staff_name: "Route Tester",
    staff_type: role,
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
