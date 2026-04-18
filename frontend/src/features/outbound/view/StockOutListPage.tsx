import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import SpaceDashboardOutlinedIcon from "@mui/icons-material/SpaceDashboardOutlined";
import { Alert, Box, Button, Chip, Stack, Typography } from "@mui/material";
import type { ResourceTableColumnDefinition } from "@/shared/components/resource-table";
import { Link as RouterLink } from "react-router-dom";

import { useStockOutListController } from "@/features/outbound/controller/useStockOutListController";
import type { SalesOrderRecord } from "@/features/outbound/model/types";
import { StockOutFiltersCard } from "@/features/outbound/view/components/StockOutFiltersCard";
import { ActionIconButton } from "@/shared/components/action-icon-button";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusBucketNav } from "@/shared/components/status-bucket-nav";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber, formatStatusLabel } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

function PackageInfoCell({ row }: { row: SalesOrderRecord }) {
  return (
    <Stack spacing={0.35} sx={{ minWidth: 0 }}>
      <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink>
      <Typography sx={{ fontWeight: 600 }} variant="body2">
        {row.customer_name || "--"}
      </Typography>
      <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
        {(row.package_type || "Package type pending")}
        {" · "}
        {formatNumber(row.package_count ?? 0)} package(s)
      </Typography>
    </Stack>
  );
}

function WaybillCell({ row }: { row: SalesOrderRecord }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
        {row.waybill_number || "--"}
      </Typography>
      <Chip
        color={row.waybill_printed ? "success" : "default"}
        label={row.waybill_printed ? "Printed" : "Not printed"}
        size="small"
        variant="outlined"
      />
    </Stack>
  );
}

function QueueStatusCell({ row }: { row: SalesOrderRecord }) {
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <StatusChip status={row.status} />
      <Typography color="text.secondary" variant="caption">
        Stage: {formatStatusLabel(row.fulfillment_stage)}
      </Typography>
      {row.exception_state && row.exception_state !== "NORMAL" ? (
        <Typography color="error.main" variant="caption">
          {formatStatusLabel(row.exception_state)}
        </Typography>
      ) : null}
    </Stack>
  );
}

function ShippingCell({ row }: { row: SalesOrderRecord }) {
  return (
    <Stack spacing={0.35} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }} variant="body2">
        {row.shipping_method || "--"}
      </Typography>
      <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
        {row.logistics_provider || "Provider pending"}
      </Typography>
      <Typography color="text.secondary" sx={{ overflowWrap: "anywhere" }} variant="caption">
        Tracking: {row.tracking_number || "--"}
      </Typography>
    </Stack>
  );
}

function PickingTimeCell({ row }: { row: SalesOrderRecord }) {
  const startedAt = formatDateTime(row.picking_started_at);
  const completedAt = formatDateTime(row.picking_completed_at);

  return (
    <Stack spacing={0.35} sx={{ minWidth: 0 }}>
      <Typography sx={{ fontWeight: 700 }} variant="body2">
        {startedAt}
      </Typography>
      <Typography color="text.secondary" variant="caption">
        Completed: {completedAt}
      </Typography>
    </Stack>
  );
}

function OperationCell({ row }: { row: SalesOrderRecord }) {
  return (
    <Button component={RouterLink} size="small" to={`/outbound/sales-orders/${row.id}`} variant="text">
      View
    </Button>
  );
}

export function StockOutListPage() {
  const controller = useStockOutListController();
  const tableError =
    controller.errorMessage
    || (controller.salesOrdersQuery.error ? parseApiError(controller.salesOrdersQuery.error) : null);
  const columns: ResourceTableColumnDefinition<SalesOrderRecord>[] = [
    {
      columnOrderLock: "start",
      header: "Package info",
      key: "packageInfo",
      minWidth: 220,
      render: (row) => <PackageInfoCell row={row} />,
      sortKey: "orderNumber",
    },
    {
      header: "Print waybill",
      key: "waybill",
      minWidth: 146,
      render: (row) => <WaybillCell row={row} />,
    },
    {
      header: "Status",
      key: "status",
      minWidth: 176,
      render: (row) => <QueueStatusCell row={row} />,
      sortKey: "status",
    },
    {
      header: "Shipping method / tracking number",
      key: "shipping",
      minWidth: 220,
      render: (row) => <ShippingCell row={row} />,
    },
    {
      header: "Create time",
      key: "createTime",
      minWidth: 170,
      render: (row) => formatDateTime(row.create_time),
      sortKey: "createTime",
    },
    {
      header: "Picking time",
      key: "pickingTime",
      minWidth: 180,
      render: (row) => <PickingTimeCell row={row} />,
    },
    {
      defaultVisible: false,
      header: "Expiration",
      key: "expiresAt",
      minWidth: 170,
      render: (row) => formatDateTime(row.expires_at),
      sortKey: "expiresAt",
    },
    {
      header: "Order time",
      key: "orderTime",
      minWidth: 170,
      render: (row) => formatDateTime(row.order_time),
      sortKey: "orderTime",
    },
    {
      columnOrderLock: "end",
      header: "Operation",
      key: "operation",
      minWidth: 108,
      render: (row) => <OperationCell row={row} />,
    },
  ];

  return (
    <Stack spacing={3} sx={{ height: "100%", minHeight: 0 }}>
      <PageHeader
        actions={(
          <Button component={RouterLink} to="/outbound/workbench" variant="outlined">
            Open workbench
          </Button>
        )}
        description="Filter the outbound package queue, monitor status buckets, and act on stock-out exceptions from one list."
        title="Stock-out list"
      />

      <Box
        sx={{
          display: "grid",
          flex: "1 1 auto",
          gap: 2.5,
          gridTemplateColumns: {
            lg: "260px minmax(0, 1fr)",
            xs: "minmax(0, 1fr)",
          },
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            border: (theme) => `1px solid ${theme.palette.divider}`,
            borderRadius: 3,
            overflow: "hidden",
            p: 1.5,
          }}
        >
          <Stack spacing={1.5}>
            <Stack spacing={0.25}>
              <Typography variant="subtitle1">Queue states</Typography>
              <Typography color="text.secondary" variant="body2">
                {controller.activeWarehouse?.warehouse_name || "All warehouses"}
              </Typography>
            </Stack>
            <StatusBucketNav
              activeValue={controller.salesOrdersView.filters.statusBucket}
              items={controller.bucketItems}
              onChange={controller.setStatusBucket}
            />
          </Stack>
        </Box>

        <Stack spacing={2.5} sx={{ minHeight: 0 }}>
          {controller.feedbackMessage ? <Alert severity="success">{controller.feedbackMessage}</Alert> : null}
          {tableError ? <Alert severity="error">{tableError}</Alert> : null}

          <StockOutFiltersCard
            activeFilterCount={controller.activeFilterCount}
            customerOptions={controller.customerOptions}
            filters={controller.salesOrdersView.filters}
            onChange={controller.updateFilter}
            onReset={controller.salesOrdersView.resetFilters}
            resultCount={controller.rows.length}
          />

          <ResourceTable
            allowHorizontalScroll
            columnVisibility={{
              enabled: true,
              storageKey: "outbound.stock-out.columns",
              triggerLabel: "Columns",
            }}
            columns={columns}
            compact
            emptyMessage="No stock-out packages match the current filters."
            error={null}
            getRowId={(row) => row.id}
            isLoading={controller.salesOrdersQuery.isLoading}
            pagination={controller.pagination}
            preserveHeaderCase
            rowSelection={controller.rowSelection}
            rows={controller.rows}
            sorting={controller.sorting}
            tableBorderRadius={2}
            toolbar={(
              <Stack spacing={1.25}>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Button component={RouterLink} size="small" to="/outbound/workbench#wave-management" variant="contained">
                    Generate wave
                  </Button>
                  <Button disabled size="small" variant="outlined">
                    Print waybills
                  </Button>
                  <Button
                    disabled={controller.selectedCount === 0 || controller.isMarkingAbnormal}
                    onClick={() => {
                      void controller.markSelectedAsAbnormal();
                    }}
                    size="small"
                    variant="outlined"
                  >
                    Mark as abnormal
                  </Button>
                  <Button
                    disabled={controller.isExporting || (controller.selectedCount === 0 && controller.pagination.total === 0)}
                    onClick={() => {
                      void controller.exportRows();
                    }}
                    size="small"
                    variant="outlined"
                  >
                    Export
                  </Button>
                </Stack>
                <Stack direction="row" flexWrap="wrap" gap={1}>
                  <Chip label={`${controller.selectedCount} selected`} size="small" variant="outlined" />
                  <Chip label={`${controller.activeFilterCount} filters`} size="small" />
                </Stack>
              </Stack>
            )}
            toolbarActions={(
              <Stack direction="row" spacing={1}>
                <ActionIconButton
                  aria-label="Refresh stock-out queue"
                  onClick={() => {
                    void controller.refetchSalesOrders();
                  }}
                  title="Refresh stock-out queue"
                >
                  <RefreshRoundedIcon fontSize="small" />
                </ActionIconButton>
                <ActionIconButton
                  aria-label="Open operations workbench"
                  component={RouterLink}
                  title="Open operations workbench"
                  to="/outbound/workbench"
                >
                  <SpaceDashboardOutlinedIcon fontSize="small" />
                </ActionIconButton>
              </Stack>
            )}
          />
        </Stack>
      </Box>
    </Stack>
  );
}
