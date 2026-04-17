import type { QueryClient, QueryKey } from "@tanstack/react-query";

export async function invalidateQueryGroups(queryClient: QueryClient, queryKeys: QueryKey[]) {
  await Promise.all(queryKeys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));
}
