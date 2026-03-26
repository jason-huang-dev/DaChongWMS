import Grid from "@mui/material/Grid";
import { Alert, Button, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import { buildStockAgeBuckets, buildStockAgeRows } from "@/features/inventory/model/mappers";
import { MetricCard } from "@/shared/components/metric-card";
import { QueryAlert } from "@/shared/components/query-alert";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export function InventoryAgingPage() {
  const { translateText } = useI18n();
  const {
    generateStockAgeReportMutation,
    reportErrorMessage,
    reportExportsQuery,
    reportSuccessMessage,
    stockAgeBalancesQuery,
  } = useInventoryController({ page: "aging" });

  const stockAgeRows = buildStockAgeRows(stockAgeBalancesQuery.data?.results ?? []);
  const stockAgeBuckets = buildStockAgeBuckets(stockAgeRows);

  return (
    <Stack spacing={2.5}>
      <Stack
        alignItems={{ md: "center" }}
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        spacing={1.5}
      >
        <Typography variant="h5">{translateText("Stock Age Report")}</Typography>
        <Button
          disabled={generateStockAgeReportMutation.isPending}
          onClick={() => generateStockAgeReportMutation.mutate()}
          variant="contained"
        >
          {translateText(generateStockAgeReportMutation.isPending ? "Generating..." : "Generate stock age report")}
        </Button>
      </Stack>
      <QueryAlert message={reportErrorMessage} />
      {reportSuccessMessage ? <Alert severity="success">{reportSuccessMessage}</Alert> : null}
      <Grid container spacing={2.5}>
        {stockAgeBuckets.map((bucket) => (
          <Grid key={bucket.label} size={{ xs: 12, md: 6, xl: 3 }}>
            <MetricCard
              helper={`${formatNumber(bucket.quantity)} on hand`}
              label={bucket.label}
              tone={bucket.label.includes("90") || bucket.label.includes("120") ? "danger" : bucket.label.includes("60") ? "warning" : "info"}
              value={bucket.count}
            />
          </Grid>
        ))}
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 8 }}>
          <ResourceTable
            columns={[
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "On hand", key: "onHand", align: "right", render: (row) => formatNumber(row.on_hand_qty) },
              { header: "Available", key: "available", align: "right", render: (row) => formatNumber(row.available_qty) },
              { header: "Age days", key: "age", align: "right", render: (row) => formatNumber(row.age_days) },
              { header: "Last activity", key: "lastActivity", render: (row) => formatDateTime(row.last_activity) },
            ]}
            error={stockAgeBalancesQuery.error ? parseApiError(stockAgeBalancesQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={stockAgeBalancesQuery.isLoading}
            rows={stockAgeRows.slice(0, 10)}
            subtitle="Oldest stock positions in the current warehouse scope."
            title="Oldest inventory positions"
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ResourceTable
            columns={[
              { header: "File", key: "file", render: (row) => row.file_name },
              { header: "Rows", key: "rows", align: "right", render: (row) => formatNumber(row.row_count) },
              { header: "Generated at", key: "generated", render: (row) => formatDateTime(row.generated_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={reportExportsQuery.error ? parseApiError(reportExportsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={reportExportsQuery.isLoading}
            rows={reportExportsQuery.data?.results ?? []}
            subtitle="Most recent generated inventory-aging exports."
            title="Generated reports"
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
