import Grid from "@mui/material/Grid";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { useNavigate } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { buildCrossWarehouseTransferCandidates } from "@/features/inventory/model/mappers";
import { MetricCard } from "@/shared/components/metric-card";
import { ResourceTable } from "@/shared/components/resource-table";
import { formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function InventoryCrossWarehousePage() {
  const navigate = useNavigate();
  const { t, translate, msg } = useI18n();
  const { activeWarehouse, activeWarehouseId, crossWarehouseBalancesQuery, warehouses } = useInventoryController({
    page: "crossWarehouse",
  });

  const crossWarehouseCandidates = buildCrossWarehouseTransferCandidates(
    crossWarehouseBalancesQuery.data?.results ?? [],
    activeWarehouseId,
  );

  return (
    <Stack spacing={2.5}>
      <Stack
        alignItems={{ md: "center" }}
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Typography variant="h5">{t("Inter-warehouse Transfer")}</Typography>
        <Button onClick={() => navigate("/transfers")} variant="contained">
          {t("Open internal move workbench")}
        </Button>
      </Stack>
      <Alert severity="info">
        {t(
          "Planning view only. The backend still supports same-warehouse transfer orders and replenishment tasks; dedicated warehouse-to-warehouse transfer requests are not yet implemented.",
        )}
      </Alert>
      {warehouses.length < 2 ? (
        <Alert severity="warning">
          {t("Add at least one more warehouse to compare stock and plan inter-warehouse moves.")}
        </Alert>
      ) : (
        <>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard
                helper={activeWarehouse ? msg("shell.warehouseContextChip", { label: activeWarehouse.warehouse_name }) : t("No warehouse selected")}
                label="Warehouse comparisons"
                tone="info"
                value={warehouses.length}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Transfer candidate SKUs" tone="warning" value={crossWarehouseCandidates.length} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard
                label="Other-warehouse available qty"
                tone="success"
                value={formatNumber(crossWarehouseCandidates.reduce((total, row) => total + row.other_warehouse_qty, 0))}
              />
            </Grid>
          </Grid>
          <ResourceTable
            columns={[
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              {
                header: activeWarehouse ? `${activeWarehouse.warehouse_name} available` : "Active warehouse available",
                key: "activeWarehouseQty",
                align: "right",
                render: (row) => formatNumber(row.active_warehouse_qty),
              },
              {
                header: "Other warehouses available",
                key: "otherWarehouseQty",
                align: "right",
                render: (row) => formatNumber(row.other_warehouse_qty),
              },
              {
                header: "Other warehouses",
                key: "otherWarehouses",
                render: (row) => row.other_warehouses.join(", "),
              },
            ]}
            error={crossWarehouseBalancesQuery.error ? parseApiError(crossWarehouseBalancesQuery.error) : null}
            getRowId={(row) => row.goods_code}
            isLoading={crossWarehouseBalancesQuery.isLoading}
            rows={crossWarehouseCandidates}
            subtitle="Cross-warehouse stock visibility to plan future warehouse-to-warehouse handoffs."
            title="Cross-warehouse stock comparison"
          />
        </>
      )}
    </Stack>
  );
}
