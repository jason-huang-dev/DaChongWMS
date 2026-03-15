import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useOutboundController } from "@/features/outbound/controller/useOutboundController";
import { CreateShipmentPanel } from "@/features/outbound/view/components/CreateShipmentPanel";
import { ScanPickPanel } from "@/features/outbound/view/components/ScanPickPanel";
import { ScanShipPanel } from "@/features/outbound/view/components/ScanShipPanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const salesOrderFields: DataViewFieldConfig<{ order_number__icontains: string; status: string }>[] = [
  { key: "order_number__icontains", label: "Order", placeholder: "SO-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Allocated", value: "ALLOCATED" },
      { label: "Picked", value: "PICKED" },
      { label: "Shipped", value: "SHIPPED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
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

export function OutboundPage() {
  const {
    activeWarehouse,
    createShipmentMutation,
    pickTasksQuery,
    pickTasksView,
    salesOrdersQuery,
    salesOrdersView,
    shipmentErrorMessage,
    shipmentSuccessMessage,
    shipmentsQuery,
    shipmentsView,
    shortPickProxyQuery,
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
                render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink>,
              },
              { header: "Customer", key: "customer", render: (row) => row.customer_name },
              { header: "Ship by", key: "shipBy", render: (row) => formatDateTime(row.requested_ship_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            emptyMessage="No outbound exceptions at the current warehouse."
            error={shortPickProxyQuery.error ? parseApiError(shortPickProxyQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={shortPickProxyQuery.isLoading}
            rows={(shortPickProxyQuery.data?.results ?? []).filter((row) =>
              ["OPEN", "ALLOCATED", "PICKING"].includes(row.status),
            )}
            severity="warning"
            subtitle="Orders already past requested ship date. This is the current proxy lane until the backend emits explicit short-pick exceptions."
            title="Short-pick follow-up / ship-risk"
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
      </Grid>
    </Stack>
  );
}
