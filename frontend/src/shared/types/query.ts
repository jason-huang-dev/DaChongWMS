import type { PaginatedResponse } from "@/shared/types/api";

export interface PaginatedQueryState<TRecord> {
  data?: PaginatedResponse<TRecord>;
  error?: unknown;
  isLoading: boolean;
}

export interface ResourceQueryState<TRecord> {
  data?: TRecord;
  error?: unknown;
  isLoading: boolean;
}
