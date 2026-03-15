import { Stack } from "@mui/material";

import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { InventoryTable } from "@/features/inventory/view/InventoryTable";
import { PageHeader } from "@/shared/components/page-header";

export function InventoryBalancesPage() {
  const { activeWarehouse, dataView, balancesQuery } = useInventoryController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Warehouse-scoped inventory positions. Operators can save queue views by stock status, lot, and serial for repeat investigations."
        title="Inventory balances"
      />
      <InventoryTable
        activeFilterCount={dataView.activeFilterCount}
        applySavedView={dataView.applySavedView}
        balancesQuery={balancesQuery}
        contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
        deleteSavedView={dataView.deleteSavedView}
        filters={dataView.filters}
        page={dataView.page}
        pageSize={dataView.pageSize}
        resetFilters={dataView.resetFilters}
        saveCurrentView={dataView.saveCurrentView}
        savedViews={dataView.savedViews}
        selectedSavedViewId={dataView.selectedSavedViewId}
        setPage={dataView.setPage}
        updateFilter={(key, value) => dataView.updateFilter(key as keyof typeof dataView.filters & string, value)}
      />
    </Stack>
  );
}
