import { useState } from "react";

import { inventoryApi } from "@/features/inventory/model/api";
import type { InventoryBalanceRecord } from "@/features/inventory/model/types";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";

const pageSize = 15;

export function useInventoryController() {
  const [page, setPage] = useState(1);
  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(["inventory", "balances"], inventoryApi.balances, page, pageSize);

  return {
    page,
    pageSize,
    setPage,
    balancesQuery,
  };
}
