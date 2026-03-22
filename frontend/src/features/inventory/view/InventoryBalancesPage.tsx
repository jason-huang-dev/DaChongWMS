import Grid from "@mui/material/Grid";
import { Alert, Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useInventoryController } from "@/features/inventory/controller/useInventoryController";
import {
  buildCrossWarehouseTransferCandidates,
  buildRecentAdjustments,
  buildStockAgeBuckets,
  buildStockAgeRows,
  sumVisibleQuantity,
} from "@/features/inventory/model/mappers";
import { InventoryAdjustmentForm } from "@/features/inventory/view/InventoryAdjustmentForm";
import { InventoryTable } from "@/features/inventory/view/InventoryTable";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { QueryAlert } from "@/shared/components/query-alert";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { useScrollToHash } from "@/shared/hooks/use-scroll-to-hash";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const sectionLinks = [
  { href: "#inventory-information", label: "Inventory Information" },
  { href: "#stock-count", label: "Stock Count" },
  { href: "#internal-move", label: "Internal Move" },
  { href: "#stock-age-report", label: "Stock Age Report" },
  { href: "#inventory-adjustment", label: "Inventory Adjustment" },
  { href: "#inter-warehouse-transfer", label: "Inter-warehouse Transfer" },
];

export function InventoryBalancesPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { translateText } = useI18n();

  useScrollToHash();

  const {
    activeWarehouse,
    activeWarehouseId,
    adjustmentBalanceReference,
    adjustmentErrorMessage,
    adjustmentInQuery,
    adjustmentReasonsQuery,
    adjustmentRulesQuery,
    adjustmentOutQuery,
    adjustmentSuccessMessage,
    balancesQuery,
    countDashboardQuery,
    countQueueQuery,
    createAdjustmentMutation,
    crossWarehouseBalancesQuery,
    dataView,
    generateStockAgeReportMutation,
    reportErrorMessage,
    reportExportsQuery,
    reportSuccessMessage,
    replenishmentTasksQuery,
    stockAgeBalancesQuery,
    transferOrdersQuery,
    warehouses,
  } = useInventoryController({
    initialBalancesFilters: {
      search: searchParams.get("search") ?? "",
      stock_status: searchParams.get("stockStatus") ?? "",
      lot_number__icontains: searchParams.get("lotNumber") ?? "",
      serial_number__icontains: searchParams.get("serialNumber") ?? "",
    },
  });

  const visibleBalances = balancesQuery.data?.results ?? [];
  const stockAgeRows = buildStockAgeRows(stockAgeBalancesQuery.data?.results ?? []);
  const stockAgeBuckets = buildStockAgeBuckets(stockAgeRows);
  const recentAdjustments = buildRecentAdjustments(
    adjustmentInQuery.data?.results ?? [],
    adjustmentOutQuery.data?.results ?? [],
  );
  const crossWarehouseCandidates = buildCrossWarehouseTransferCandidates(
    crossWarehouseBalancesQuery.data?.results ?? [],
    activeWarehouseId,
  );

  return (
    <Stack spacing={4}>
      <PageHeader
        description="Warehouse-scoped stock visibility with count, move, aging, adjustment, and cross-warehouse planning views."
        title="Inventory operations"
      />

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {sectionLinks.map((sectionLink) => (
          <Button component="a" href={sectionLink.href} key={sectionLink.href} size="small" variant="outlined">
            {translateText(sectionLink.label)}
          </Button>
        ))}
      </Stack>

      <Box id="inventory-information">
        <Stack spacing={2}>
          <Typography variant="h5">{translateText("Inventory Information")}</Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard
                helper={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                label="Inventory positions"
                value={balancesQuery.data?.count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard
                helper="Visible rows after current filters."
                label="Visible on-hand qty"
                value={formatNumber(sumVisibleQuantity(visibleBalances, "on_hand_qty"))}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard
                helper="Visible rows after current filters."
                label="Visible available qty"
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
      </Box>

      <Box id="stock-count">
        <Stack spacing={2}>
          <Stack
            alignItems={{ md: "center" }}
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Typography variant="h5">{translateText("Stock Count")}</Typography>
            <Button onClick={() => navigate("/counting#variance-approvals")} variant="contained">
              {translateText("Open counting")}
            </Button>
          </Stack>
          <QueryAlert message={countDashboardQuery.error ? parseApiError(countDashboardQuery.error) : null} />
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Pending approvals" value={countDashboardQuery.data?.pending_total ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Approval SLA breaches" value={countDashboardQuery.data?.pending_sla_breach_count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Recount SLA breaches" value={countDashboardQuery.data?.recount_sla_breach_count ?? "--"} />
            </Grid>
          </Grid>
          <ResourceTable
            columns={[
              {
                header: "Count",
                key: "count",
                render: (row) => <RecordLink to={`/counting/approvals/${row.id}`}>{row.count_number}</RecordLink>,
              },
              { header: "Location", key: "location", render: (row) => row.location_code },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
              { header: "Required role", key: "role", render: (row) => row.required_role },
              { header: "Requested at", key: "requestedAt", render: (row) => formatDateTime(row.requested_at) },
            ]}
            error={countQueueQuery.error ? parseApiError(countQueueQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={countQueueQuery.isLoading}
            rows={countQueueQuery.data?.results ?? []}
            subtitle="Supervisor queue blocking count-driven stock adjustments."
            title="Pending variance approvals"
          />
        </Stack>
      </Box>

      <Box id="internal-move">
        <Stack spacing={2}>
          <Stack
            alignItems={{ md: "center" }}
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Typography variant="h5">{translateText("Internal Move")}</Typography>
            <Button onClick={() => navigate("/transfers")} variant="contained">
              {translateText("Open transfers")}
            </Button>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricCard label="Open transfer orders" value={transferOrdersQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 6 }}>
              <MetricCard label="Open replenishment tasks" value={replenishmentTasksQuery.data?.count ?? "--"} />
            </Grid>
          </Grid>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, xl: 6 }}>
              <ResourceTable
                columns={[
                  {
                    header: "Transfer",
                    key: "transfer",
                    render: (row) => <RecordLink to={`/transfers/transfer-orders/${row.id}`}>{row.transfer_number}</RecordLink>,
                  },
                  { header: "Requested", key: "requested", render: (row) => row.requested_date || "--" },
                  { header: "Lines", key: "lines", align: "right", render: (row) => formatNumber(row.lines.length) },
                  { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
                ]}
                error={transferOrdersQuery.error ? parseApiError(transferOrdersQuery.error) : null}
                getRowId={(row) => row.id}
                isLoading={transferOrdersQuery.isLoading}
                rows={transferOrdersQuery.data?.results ?? []}
                subtitle="Planned internal moves for the selected warehouse."
                title="Transfer orders"
              />
            </Grid>
            <Grid size={{ xs: 12, xl: 6 }}>
              <ResourceTable
                columns={[
                  { header: "Task", key: "task", render: (row) => row.task_number },
                  { header: "SKU", key: "sku", render: (row) => row.goods_code },
                  { header: "From", key: "from", render: (row) => row.from_location_code },
                  { header: "To", key: "to", render: (row) => row.to_location_code || "--" },
                  { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
                  { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
                ]}
                error={replenishmentTasksQuery.error ? parseApiError(replenishmentTasksQuery.error) : null}
                getRowId={(row) => row.id}
                isLoading={replenishmentTasksQuery.isLoading}
                rows={replenishmentTasksQuery.data?.results ?? []}
                subtitle="System-generated or manual replenishment work into pick faces and forward locations."
                title="Replenishment tasks"
              />
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Box id="stock-age-report">
        <Stack spacing={2}>
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
      </Box>

      <Box id="inventory-adjustment">
        <Stack spacing={2}>
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
                    <MetricCard label="Active adjustment reasons" value={adjustmentReasonsQuery.data?.count ?? "--"} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <MetricCard label="Approval rules" value={adjustmentRulesQuery.data?.count ?? "--"} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <MetricCard label="Recent adjustments" value={recentAdjustments.length} />
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
      </Box>

      <Box id="inter-warehouse-transfer">
        <Stack spacing={2}>
          <Stack
            alignItems={{ md: "center" }}
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            spacing={1.5}
          >
            <Typography variant="h5">{translateText("Inter-warehouse Transfer")}</Typography>
            <Button onClick={() => navigate("/transfers")} variant="contained">
              {translateText("Open internal move workbench")}
            </Button>
          </Stack>
          <Alert severity="info">
            {translateText(
              "Planning view only. The backend still supports same-warehouse transfer orders and replenishment tasks; dedicated warehouse-to-warehouse transfer requests are not yet implemented.",
            )}
          </Alert>
          {warehouses.length < 2 ? (
            <Alert severity="warning">
              {translateText("Add at least one more warehouse to compare stock and plan inter-warehouse moves.")}
            </Alert>
          ) : (
            <>
              <Grid container spacing={2.5}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <MetricCard
                    helper={activeWarehouse ? `Current warehouse: ${activeWarehouse.warehouse_name}` : "No warehouse selected"}
                    label="Warehouse comparisons"
                    value={warehouses.length}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <MetricCard label="Transfer candidate SKUs" value={crossWarehouseCandidates.length} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <MetricCard
                    label="Other-warehouse available qty"
                    value={formatNumber(
                      crossWarehouseCandidates.reduce((total, row) => total + row.other_warehouse_qty, 0),
                    )}
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
      </Box>
    </Stack>
  );
}
