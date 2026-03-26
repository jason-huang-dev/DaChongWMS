import Grid from "@mui/material/Grid";
import { Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { sumVisibleQuantity } from "@/features/inventory/model/mappers";
import { InventoryTable } from "@/features/inventory/view/InventoryTable";
import { MetricCard } from "@/shared/components/metric-card";
import { formatNumber } from "@/shared/utils/format";

export function InventoryBalancesPage() {
  const [searchParams] = useSearchParams();
  const { translateText } = useI18n();

  const {
    activeWarehouse,
    balancesQuery,
    dataView,
  } = useInventoryController({
    page: "balances",
    initialBalancesFilters: {
      search: searchParams.get("search") ?? "",
      stock_status: searchParams.get("stockStatus") ?? "",
      lot_number__icontains: searchParams.get("lotNumber") ?? "",
      serial_number__icontains: searchParams.get("serialNumber") ?? "",
    },
  });

  const visibleBalances = balancesQuery.data?.results ?? [];

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5">{translateText("Inventory Information")}</Typography>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            helper={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
            label="Inventory positions"
            tone="info"
            value={balancesQuery.data?.count ?? "--"}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            helper="Visible rows after current filters."
            label="Visible on-hand qty"
            tone="success"
            value={formatNumber(sumVisibleQuantity(visibleBalances, "on_hand_qty"))}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <MetricCard
            helper="Visible rows after current filters."
            label="Visible available qty"
            tone="info"
            value={formatNumber(sumVisibleQuantity(visibleBalances, "available_qty"))}
          />
        </Grid>
      </Grid>
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
