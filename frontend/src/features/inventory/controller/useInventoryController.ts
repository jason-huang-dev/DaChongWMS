import { useTenantScope } from "@/app/scope-context";
import { inventoryApi } from "@/features/inventory/model/api";
import type { InventoryBalanceRecord } from "@/features/inventory/model/types";
import { useDataView } from "@/shared/hooks/use-data-view";
import { usePaginatedResource } from "@/shared/hooks/use-paginated-resource";

const pageSize = 15;

export function useInventoryController() {
  const { company, activeWarehouse, activeWarehouseId } = useTenantScope();
  const dataView = useDataView({
    viewKey: `inventory-balances.${company?.openid ?? "anonymous"}`,
    defaultFilters: {
      stock_status: "",
      lot_number__icontains: "",
      serial_number__icontains: "",
    },
    pageSize,
  });
  const balancesQuery = usePaginatedResource<InventoryBalanceRecord>(
    ["inventory", "balances"],
    inventoryApi.balances,
    dataView.page,
    pageSize,
    {
      warehouse: activeWarehouseId ?? undefined,
      ...dataView.queryFilters,
    },
  );

  return {
    company,
    activeWarehouse,
    dataView,
    balancesQuery,
  };
}
