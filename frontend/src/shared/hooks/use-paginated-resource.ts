import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/http";
import type { PaginatedResponse } from "@/shared/types/api";

interface QueryOptions {
  enabled?: boolean;
}

export function usePaginatedResource<TRecord>(
  queryKey: readonly unknown[],
  path: string,
  page: number,
  pageSize: number,
  extraQuery?: Record<string, string | number | boolean | null | undefined>,
  options?: QueryOptions,
) {
  return useQuery({
    queryKey: [...queryKey, page, pageSize, extraQuery ?? {}],
    queryFn: () =>
      apiGet<PaginatedResponse<TRecord>>(path, {
        page,
        page_size: pageSize,
        ...extraQuery,
      }),
    placeholderData: keepPreviousData,
    enabled: options?.enabled,
  });
}
