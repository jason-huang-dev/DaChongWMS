import { useQuery } from "@tanstack/react-query";

import { apiGet } from "@/lib/http";

interface QueryOptions {
  enabled?: boolean;
}

export function useResource<TResponse>(
  queryKey: readonly unknown[],
  path: string,
  extraQuery?: Record<string, string | number | boolean | null | undefined>,
  options?: QueryOptions,
) {
  return useQuery({
    queryKey: [...queryKey, extraQuery ?? {}],
    queryFn: () => apiGet<TResponse>(path, extraQuery),
    enabled: options?.enabled,
  });
}
