import Grid from "@mui/material/Grid";
import { Alert, Button, ButtonGroup, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useStatisticsController } from "@/features/statistics/controller/useStatisticsController";
import type {
  ActivityPerformanceRow,
  StatisticsFlowRow,
  StatisticsTimeWindow,
  WarehouseAnalysisRow,
} from "@/features/statistics/model/types";
import { PageHeader } from "@/shared/components/page-header";
import { ResourceTable } from "@/shared/components/resource-table";
import { SummaryCard } from "@/shared/components/summary-card";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const timeWindowOptions: Array<{ label: string; value: StatisticsTimeWindow }> = [
  { label: "This week", value: "WEEK" },
  { label: "This month", value: "MONTH" },
  { label: "This year", value: "YEAR" },
];

function buildFlowColumns() {
  return [
    { header: "Segment", key: "segment", render: (row: StatisticsFlowRow) => row.segment },
    { header: "Documents", key: "documents", align: "right" as const, render: (row: StatisticsFlowRow) => formatNumber(row.documents) },
    { header: "Units", key: "units", align: "right" as const, render: (row: StatisticsFlowRow) => formatNumber(row.units) },
    {
      header: "Completed documents",
      key: "completedDocuments",
      align: "right" as const,
      render: (row: StatisticsFlowRow) => formatNumber(row.completed_documents),
    },
    {
      header: "Completed units",
      key: "completedUnits",
      align: "right" as const,
      render: (row: StatisticsFlowRow) => formatNumber(row.completed_units),
    },
    { header: "Focus", key: "focus", render: (row: StatisticsFlowRow) => row.focus },
  ];
}

function buildActivityColumns() {
  return [
    { header: "Staff", key: "staff", render: (row: ActivityPerformanceRow) => row.staff_name },
    {
      header: "Activity count",
      key: "activityCount",
      align: "right" as const,
      render: (row: ActivityPerformanceRow) => formatNumber(row.activity_count),
    },
    {
      header: "Quantity",
      key: "quantity",
      align: "right" as const,
      render: (row: ActivityPerformanceRow) => formatNumber(row.quantity),
    },
    {
      header: "Last activity",
      key: "lastActivity",
      render: (row: ActivityPerformanceRow) => formatDateTime(row.last_activity_at),
    },
  ];
}

function buildWarehouseColumns() {
  return [
    { header: "Warehouse", key: "warehouse", render: (row: WarehouseAnalysisRow) => row.warehouse_name },
    {
      header: "On-hand units",
      key: "onHandUnits",
      align: "right" as const,
      render: (row: WarehouseAnalysisRow) => formatNumber(row.on_hand_units),
    },
    {
      header: "Standard stock-in orders",
      key: "stockInOrders",
      align: "right" as const,
      render: (row: WarehouseAnalysisRow) => formatNumber(row.standard_stock_in_orders),
    },
    {
      header: "Stock-out orders",
      key: "stockOutOrders",
      align: "right" as const,
      render: (row: WarehouseAnalysisRow) => formatNumber(row.stock_out_orders),
    },
    {
      header: "Direct shipping orders",
      key: "directShippingOrders",
      align: "right" as const,
      render: (row: WarehouseAnalysisRow) => formatNumber(row.direct_shipping_orders),
    },
    {
      header: "After-sales returns",
      key: "afterSalesReturns",
      align: "right" as const,
      render: (row: WarehouseAnalysisRow) => formatNumber(row.after_sales_returns),
    },
  ];
}

export function StatisticsPage() {
  const controller = useStatisticsController();
  const { t, translate, msg } = useI18n();

  const inboundLoading =
    controller.standardPurchaseOrdersQuery.isLoading ||
    controller.standardAsnsQuery.isLoading ||
    controller.signingQuery.isLoading ||
    controller.receivingQuery.isLoading ||
    controller.listingQuery.isLoading;
  const inboundError =
    controller.standardPurchaseOrdersQuery.error ??
    controller.standardAsnsQuery.error ??
    controller.signingQuery.error ??
    controller.receivingQuery.error ??
    controller.listingQuery.error;
  const outboundLoading =
    controller.salesOrdersQuery.isLoading ||
    controller.pickingQuery.isLoading ||
    controller.packingQuery.isLoading ||
    controller.shipmentsQuery.isLoading;
  const outboundError =
    controller.salesOrdersQuery.error ??
    controller.pickingQuery.error ??
    controller.packingQuery.error ??
    controller.shipmentsQuery.error;
  const returnsLoading =
    controller.returnOrdersQuery.isLoading ||
    controller.returnReceiptsQuery.isLoading ||
    controller.returnDispositionsQuery.isLoading;
  const returnsError =
    controller.returnOrdersQuery.error ??
    controller.returnReceiptsQuery.error ??
    controller.returnDispositionsQuery.error;

  return (
    <Stack spacing={3}>
      <PageHeader
        actions={
          <ButtonGroup color="inherit" size="small" variant="outlined">
            {timeWindowOptions.map((option) => (
              <Button
                key={option.value}
                onClick={() => controller.setTimeWindow(option.value)}
                variant={controller.timeWindow === option.value ? "contained" : "outlined"}
              >
                {t(option.label)}
              </Button>
            ))}
          </ButtonGroup>
        }
        description="Warehouse-scoped operational statistics across stock-in, stock-out, listing, picking, packing, after-sales, and direct shipping."
        title="Statistics"
      />
      {!controller.company ? (
        <Alert severity="info">{t("Select an active workspace membership before viewing statistics.")}</Alert>
      ) : null}
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Current scope for the statistics workbench."
            items={[
              { label: "Workspace", value: controller.company?.label ?? "No workspace selected" },
              { label: "Warehouse context", value: controller.activeWarehouse?.warehouse_name ?? "All warehouses" },
              { label: "Current period", value: controller.summary.currentPeriod },
            ]}
            title="Scope"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Top-line stock in and stock out document volume."
            items={[
              { label: "Inbound documents", value: formatNumber(controller.summary.inboundDocuments) },
              { label: "Outbound documents", value: formatNumber(controller.summary.outboundDocuments) },
              { label: "Direct shipping orders", value: formatNumber(controller.summary.directShippingOrders) },
            ]}
            title="Stock In&Out"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Warehouse footprint for the active period."
            items={[
              { label: "Active warehouses", value: formatNumber(controller.summary.activeWarehouses) },
              { label: "On-hand units", value: formatNumber(controller.summary.onHandUnits) },
              { label: "After-sales orders", value: formatNumber(controller.summary.afterSalesOrders) },
            ]}
            title="Warehouse Analysis"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <SummaryCard
            description="Top performer snapshot across receiving, listing, picking, packing, and after-sales."
            items={[
              { label: "Active staff", value: formatNumber(controller.summary.activeStaff) },
              { label: "Top performer", value: controller.summary.topPerformer?.staff_name ?? "None" },
              {
                label: "Total activities",
                value: formatNumber(controller.summary.topPerformer?.total_activities ?? 0),
              },
            ]}
            title="Staff Performance"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ResourceTable
            title="Stock In&Out"
            subtitle="Overall movement profile for inbound, outbound, reverse logistics, and direct shipping."
            rows={controller.stockInOutRows}
            columns={buildFlowColumns()}
            getRowId={(row) => row.id}
            isLoading={inboundLoading || outboundLoading || returnsLoading}
            error={
              inboundError || outboundError || returnsError
                ? parseApiError(inboundError ?? outboundError ?? returnsError)
                : null
            }
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Standard Stock-in"
            subtitle="Standard inbound planning, receiving, and listing throughput."
            rows={controller.standardStockInRows}
            columns={buildFlowColumns()}
            getRowId={(row) => row.id}
            isLoading={inboundLoading}
            error={inboundError ? parseApiError(inboundError) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Stock Out Statistics"
            subtitle="Outbound demand, picking, packing, and shipping completion."
            rows={controller.stockOutRows}
            columns={buildFlowColumns()}
            getRowId={(row) => row.id}
            isLoading={outboundLoading}
            error={outboundError ? parseApiError(outboundError) : null}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ResourceTable
            title="Warehouse Analysis"
            subtitle="Cross-warehouse view of stock, inbound demand, outbound demand, and after-sales load."
            rows={controller.warehouseAnalysisRows}
            columns={buildWarehouseColumns()}
            getRowId={(row) => row.id}
            isLoading={controller.warehouseAnalysisQuery.isLoading}
            error={controller.warehouseAnalysisQuery.error ? parseApiError(controller.warehouseAnalysisQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <ResourceTable
            title="Staff Performance"
            subtitle="Combined cross-function activity ranking for warehouse execution staff."
            rows={controller.staffPerformanceRows}
            columns={[
              { header: "Staff", key: "staff", render: (row) => row.staff_name },
              { header: "Receiving", key: "receiving", align: "right", render: (row) => formatNumber(row.receiving) },
              { header: "Listing", key: "listing", align: "right", render: (row) => formatNumber(row.listing) },
              { header: "Picking", key: "picking", align: "right", render: (row) => formatNumber(row.picking) },
              { header: "Packing", key: "packing", align: "right", render: (row) => formatNumber(row.packing) },
              { header: "After Sales", key: "afterSales", align: "right", render: (row) => formatNumber(row.after_sales) },
              { header: "Total activities", key: "totalActivities", align: "right", render: (row) => formatNumber(row.total_activities) },
              { header: "Total units", key: "totalUnits", align: "right", render: (row) => formatNumber(row.total_quantity) },
              { header: "Last activity", key: "lastActivity", render: (row) => formatDateTime(row.last_activity_at) },
            ]}
            getRowId={(row) => row.id}
            isLoading={inboundLoading || outboundLoading || returnsLoading}
            error={
              inboundError || outboundError || returnsError
                ? parseApiError(inboundError ?? outboundError ?? returnsError)
                : null
            }
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Receiving"
            subtitle="Receiving throughput by operator."
            rows={controller.receivingRows}
            columns={buildActivityColumns()}
            getRowId={(row) => row.id}
            isLoading={controller.receivingQuery.isLoading}
            error={controller.receivingQuery.error ? parseApiError(controller.receivingQuery.error) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Listing"
            subtitle="Putaway and listing completion by operator."
            rows={controller.listingRows}
            columns={buildActivityColumns()}
            getRowId={(row) => row.id}
            isLoading={controller.listingQuery.isLoading}
            error={controller.listingQuery.error ? parseApiError(controller.listingQuery.error) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Picking"
            subtitle="Picking completion by operator."
            rows={controller.pickingRows}
            columns={buildActivityColumns()}
            getRowId={(row) => row.id}
            isLoading={controller.pickingQuery.isLoading}
            error={controller.pickingQuery.error ? parseApiError(controller.pickingQuery.error) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Packing"
            subtitle="Packing execution by operator."
            rows={controller.packingRows}
            columns={buildActivityColumns()}
            getRowId={(row) => row.id}
            isLoading={controller.packingQuery.isLoading}
            error={controller.packingQuery.error ? parseApiError(controller.packingQuery.error) : null}
          />
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="After Sales"
            subtitle="Return intake and disposition statistics for reverse logistics."
            rows={controller.afterSalesStatisticsRows}
            columns={buildFlowColumns()}
            getRowId={(row) => row.id}
            isLoading={returnsLoading}
            error={returnsError ? parseApiError(returnsError) : null}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            title="Direct Shipping"
            subtitle="Dropship order, packing, shipment, and exception visibility."
            rows={controller.directShippingRows}
            columns={buildFlowColumns()}
            getRowId={(row) => row.id}
            isLoading={outboundLoading}
            error={outboundError ? parseApiError(outboundError) : null}
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
