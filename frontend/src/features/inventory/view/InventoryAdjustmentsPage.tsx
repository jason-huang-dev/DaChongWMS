import Grid from "@mui/material/Grid";
import { Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { buildRecentAdjustments } from "@/features/inventory/model/mappers";
import { InventoryAdjustmentForm } from "@/features/inventory/view/InventoryAdjustmentForm";
import { MetricCard } from "@/shared/components/metric-card";
import { ResourceTable } from "@/shared/components/resource-table";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function InventoryAdjustmentsPage() {
  const { translateText } = useI18n();
  const {
    adjustmentBalanceReference,
    adjustmentErrorMessage,
    adjustmentInQuery,
    adjustmentOutQuery,
    adjustmentReasonsQuery,
    adjustmentRulesQuery,
    adjustmentSuccessMessage,
    createAdjustmentMutation,
  } = useInventoryController({ page: "adjustments" });

  const recentAdjustments = buildRecentAdjustments(
    adjustmentInQuery.data?.results ?? [],
    adjustmentOutQuery.data?.results ?? [],
  );

  return (
    <Stack spacing={2.5}>
      <Typography variant="h5">{translateText("Inventory Adjustment")}</Typography>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 5 }}>
          <InventoryAdjustmentForm
            errorMessage={adjustmentErrorMessage}
            inventoryBalanceReference={adjustmentBalanceReference}
            isSubmitting={createAdjustmentMutation.isPending}
            onSubmit={(values) => createAdjustmentMutation.mutateAsync(values)}
            successMessage={adjustmentSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 7 }}>
          <Stack spacing={2}>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 4 }}>
                <MetricCard label="Active adjustment reasons" tone="info" value={adjustmentReasonsQuery.data?.count ?? "--"} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <MetricCard label="Approval rules" tone="warning" value={adjustmentRulesQuery.data?.count ?? "--"} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <MetricCard label="Recent adjustments" tone="danger" value={recentAdjustments.length} />
              </Grid>
            </Grid>
            <ResourceTable
              columns={[
                { header: "Type", key: "type", render: (row) => formatStatusLabel(row.movement_type) },
                { header: "SKU", key: "sku", render: (row) => row.goods_code },
                { header: "Location", key: "location", render: (row) => row.to_location_code || row.from_location_code },
                { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
                { header: "Reason", key: "reason", render: (row) => row.reason || "--" },
                { header: "Performed by", key: "performedBy", render: (row) => row.performed_by },
                { header: "Occurred at", key: "occurredAt", render: (row) => formatDateTime(row.occurred_at) },
              ]}
              error={
                adjustmentInQuery.error || adjustmentOutQuery.error
                  ? parseApiError(adjustmentInQuery.error ?? adjustmentOutQuery.error)
                  : null
              }
              getRowId={(row) => row.id}
              isLoading={adjustmentInQuery.isLoading || adjustmentOutQuery.isLoading}
              rows={recentAdjustments}
              subtitle="Latest posted manual stock corrections for the selected warehouse."
              title="Recent manual adjustments"
            />
          </Stack>
        </Grid>
      </Grid>
    </Stack>
  );
}
