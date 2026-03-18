import Grid from "@mui/material/Grid";
import { Button, Stack } from "@mui/material";

import { useOutboundController } from "@/features/outbound/controller/useOutboundController";
import { CreateShipmentPanel } from "@/features/outbound/view/components/CreateShipmentPanel";
import { ScanPickPanel } from "@/features/outbound/view/components/ScanPickPanel";
import { ScanShipPanel } from "@/features/outbound/view/components/ScanShipPanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusBucketNav } from "@/shared/components/status-bucket-nav";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const salesOrderFields: DataViewFieldConfig<{ order_number__icontains: string; requested_ship_date__gte: string; requested_ship_date__lte: string; status: string }>[] = [
  { key: "order_number__icontains", label: "Order", placeholder: "SO-1001" },
  { key: "requested_ship_date__gte", label: "Ship from", type: "date" },
  { key: "requested_ship_date__lte", label: "Ship to", type: "date" },
];

const pickTaskFields: DataViewFieldConfig<{ task_number__icontains: string; status: string }>[] = [
  { key: "task_number__icontains", label: "Task", placeholder: "PK-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Assigned", value: "ASSIGNED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const shipmentFields: DataViewFieldConfig<{ shipment_number__icontains: string; status: string }>[] = [
  { key: "shipment_number__icontains", label: "Shipment", placeholder: "SHP-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Confirmed", value: "CONFIRMED" },
      { label: "Shipped", value: "SHIPPED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const dockLoadFields: DataViewFieldConfig<{ search: string; status: string }>[] = [
  { key: "search", label: "Search", placeholder: "Shipment, trailer, SKU, verifier" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Verified", value: "VERIFIED" },
      { label: "Rejected", value: "REJECTED" },
    ],
  },
];

export function OutboundPage() {
  const {
    activeWarehouse,
    createShipmentMutation,
    pickTasksQuery,
    pickTasksView,
    salesOrdersQuery,
    salesOrdersView,
    salesOrderStatusCounts,
    shipmentErrorMessage,
    shipmentSuccessMessage,
    shipmentsQuery,
    shipmentsView,
    dockLoadVerificationsQuery,
    dockLoadView,
    resolveShortPickMutation,
    shortPicksQuery,
  } = useOutboundController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="View allocation, pick, and shipment activity for outbound execution, including scan-first handheld actions. Filters and saved views keep ship queues consistent by warehouse."
        title="Outbound operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 4 }}>
          <CreateShipmentPanel
            errorMessage={shipmentErrorMessage}
            isPending={createShipmentMutation.isPending}
            onSubmit={(values) => createShipmentMutation.mutateAsync(values)}
            successMessage={shipmentSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanPickPanel />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanShipPanel />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ExceptionLane
            columns={[
              {
                header: "Order",
                key: "order",
                render: (row) => <RecordLink to={`/outbound/sales-orders/${row.sales_order}`}>{row.order_number}</RecordLink>,
              },
              { header: "Task", key: "task", render: (row) => row.pick_task },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "Location", key: "location", render: (row) => row.from_location_code },
              { header: "Short qty", key: "shortQty", align: "right", render: (row) => formatNumber(row.short_qty) },
              { header: "Reason", key: "reason", render: (row) => row.reason_code.split("_").join(" ") },
              {
                header: "Action",
                key: "action",
                render: (row) => (
                  <Button
                    disabled={resolveShortPickMutation.isPending}
                    onClick={() => resolveShortPickMutation.mutate(row.id)}
                    size="small"
                    variant="outlined"
                  >
                    Resolve
                  </Button>
                ),
              },
            ]}
            emptyMessage="No outbound exceptions at the current warehouse."
            error={shortPicksQuery.error ? parseApiError(shortPicksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={shortPicksQuery.isLoading}
            rows={shortPicksQuery.data?.results ?? []}
            severity="warning"
            subtitle="Explicit short-pick exceptions reported from outbound pick execution, ready for supervisor follow-up."
            title="Short-pick follow-up"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Customer", key: "customer", render: (row) => row.customer_name },
              { header: "Ship date", key: "shipDate", render: (row) => formatDateTime(row.requested_ship_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={salesOrdersQuery.error ? parseApiError(salesOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={salesOrdersQuery.isLoading}
            pagination={{
              page: salesOrdersView.page,
              pageSize: salesOrdersView.pageSize,
              total: salesOrdersQuery.data?.count ?? 0,
              onPageChange: salesOrdersView.setPage,
            }}
            rows={salesOrdersQuery.data?.results ?? []}
            subtitle="Outbound demand waiting to be picked or shipped"
            title="Sales orders"
            toolbar={
              <Stack spacing={1.5}>
                <StatusBucketNav
                  activeValue={salesOrdersView.filters.status || "ALL"}
                  items={[
                    { value: "ALL", label: "All sales orders", count: salesOrderStatusCounts.all.data?.count ?? "--" },
                    { value: "OPEN", label: "Open", count: salesOrderStatusCounts.open.data?.count ?? "--" },
                    { value: "ALLOCATED", label: "Allocated", count: salesOrderStatusCounts.allocated.data?.count ?? "--" },
                    { value: "PICKED", label: "Picked", count: salesOrderStatusCounts.picked.data?.count ?? "--" },
                    { value: "SHIPPED", label: "Shipped", count: salesOrderStatusCounts.shipped.data?.count ?? "--" },
                    { value: "CANCELLED", label: "Cancelled", count: salesOrderStatusCounts.cancelled.data?.count ?? "--" },
                  ]}
                  onChange={(value) => salesOrdersView.updateFilter("status", value === "ALL" ? "" : value)}
                />
                <DataViewToolbar
                  activeFilterCount={salesOrdersView.activeFilterCount}
                  contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                  fields={salesOrderFields}
                  filters={salesOrdersView.filters}
                  onChange={salesOrdersView.updateFilter}
                  onReset={salesOrdersView.resetFilters}
                  resultCount={salesOrdersQuery.data?.count}
                  savedViews={{
                    items: salesOrdersView.savedViews,
                    selectedId: salesOrdersView.selectedSavedViewId,
                    onApply: salesOrdersView.applySavedView,
                    onDelete: salesOrdersView.deleteSavedView,
                    onSave: salesOrdersView.saveCurrentView,
                  }}
                />
              </Stack>
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Task", key: "task", render: (row) => row.task_number },
              { header: "Order", key: "order", render: (row) => row.order_number },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "From", key: "from", render: (row) => row.from_location_code },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.quantity) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={pickTasksQuery.error ? parseApiError(pickTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={pickTasksQuery.isLoading}
            pagination={{
              page: pickTasksView.page,
              pageSize: pickTasksView.pageSize,
              total: pickTasksQuery.data?.count ?? 0,
              onPageChange: pickTasksView.setPage,
            }}
            rows={pickTasksQuery.data?.results ?? []}
            subtitle="Current pick execution queue"
            title="Pick tasks"
            toolbar={
              <DataViewToolbar
                activeFilterCount={pickTasksView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={pickTaskFields}
                filters={pickTasksView.filters}
                onChange={pickTasksView.updateFilter}
                onReset={pickTasksView.resetFilters}
                resultCount={pickTasksQuery.data?.count}
                savedViews={{
                  items: pickTasksView.savedViews,
                  selectedId: pickTasksView.selectedSavedViewId,
                  onApply: pickTasksView.applySavedView,
                  onDelete: pickTasksView.deleteSavedView,
                  onSave: pickTasksView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Shipment", key: "shipment", render: (row) => row.shipment_number },
              { header: "Order", key: "order", render: (row) => row.order_number },
              { header: "Stage", key: "stage", render: (row) => row.staging_location_code },
              { header: "Shipped by", key: "by", render: (row) => row.shipped_by || "--" },
              { header: "Shipped at", key: "at", render: (row) => formatDateTime(row.shipped_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={shipmentsQuery.error ? parseApiError(shipmentsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={shipmentsQuery.isLoading}
            pagination={{
              page: shipmentsView.page,
              pageSize: shipmentsView.pageSize,
              total: shipmentsQuery.data?.count ?? 0,
              onPageChange: shipmentsView.setPage,
            }}
            rows={shipmentsQuery.data?.results ?? []}
            subtitle="Outbound shipment confirmations"
            title="Shipments"
            toolbar={
              <DataViewToolbar
                activeFilterCount={shipmentsView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={shipmentFields}
                filters={shipmentsView.filters}
                onChange={shipmentsView.updateFilter}
                onReset={shipmentsView.resetFilters}
                resultCount={shipmentsQuery.data?.count}
                savedViews={{
                  items: shipmentsView.savedViews,
                  selectedId: shipmentsView.selectedSavedViewId,
                  onApply: shipmentsView.applySavedView,
                  onDelete: shipmentsView.deleteSavedView,
                  onSave: shipmentsView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "Shipment", key: "shipment", render: (row) => row.shipment_number },
              { header: "Dock", key: "dock", render: (row) => row.dock_location_code },
              { header: "Trailer", key: "trailer", render: (row) => row.trailer_reference || "--" },
              { header: "SKU", key: "sku", render: (row) => row.goods_code },
              { header: "LPN", key: "lpn", render: (row) => row.license_plate_code || "--" },
              { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.verified_qty) },
              { header: "Verified by", key: "by", render: (row) => row.verified_by || "--" },
              { header: "Verified at", key: "at", render: (row) => formatDateTime(row.verified_at) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={dockLoadVerificationsQuery.error ? parseApiError(dockLoadVerificationsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={dockLoadVerificationsQuery.isLoading}
            pagination={{
              page: dockLoadView.page,
              pageSize: dockLoadView.pageSize,
              total: dockLoadVerificationsQuery.data?.count ?? 0,
              onPageChange: dockLoadView.setPage,
            }}
            rows={dockLoadVerificationsQuery.data?.results ?? []}
            subtitle="Confirmed dock-load movements produced by shipment scans, with trailer and dock context for final outbound execution."
            title="Dock load verification"
            toolbar={
              <DataViewToolbar
                activeFilterCount={dockLoadView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={dockLoadFields}
                filters={dockLoadView.filters}
                onChange={dockLoadView.updateFilter}
                onReset={dockLoadView.resetFilters}
                resultCount={dockLoadVerificationsQuery.data?.count}
                savedViews={{
                  items: dockLoadView.savedViews,
                  selectedId: dockLoadView.selectedSavedViewId,
                  onApply: dockLoadView.applySavedView,
                  onDelete: dockLoadView.deleteSavedView,
                  onSave: dockLoadView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
