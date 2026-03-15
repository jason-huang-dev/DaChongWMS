import Grid from "@mui/material/Grid";
import { Stack } from "@mui/material";

import { useInboundController } from "@/features/inbound/controller/useInboundController";
import { CreateReceiptPanel } from "@/features/inbound/view/components/CreateReceiptPanel";
import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const purchaseOrderFields: DataViewFieldConfig<{ po_number__icontains: string; status: string }>[] = [
  { key: "po_number__icontains", label: "PO number", placeholder: "PO-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Partially received", value: "PARTIAL" },
      { label: "Received", value: "RECEIVED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const receiptFields: DataViewFieldConfig<{ receipt_number__icontains: string; status: string }>[] = [
  { key: "receipt_number__icontains", label: "Receipt", placeholder: "RCPT-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Posted", value: "POSTED" },
      { label: "Closed", value: "CLOSED" },
    ],
  },
];

const putawayFields: DataViewFieldConfig<{ task_number__icontains: string; status: string }>[] = [
  { key: "task_number__icontains", label: "Task", placeholder: "PT-1001" },
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

export function InboundPage() {
  const {
    activeWarehouse,
    createReceiptMutation,
    overduePurchaseOrdersQuery,
    purchaseOrdersQuery,
    purchaseOrdersView,
    putawayTasksQuery,
    putawayTasksView,
    receiptErrorMessage,
    receiptSuccessMessage,
    receiptsQuery,
    receiptsView,
  } = useInboundController();

  return (
    <Stack spacing={3}>
      <PageHeader
        description="View the current inbound workload across purchasing, receipt posting, putaway completion, and scan-first handheld actions. Filters and saved views keep each queue reusable."
        title="Inbound operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, xl: 4 }}>
          <CreateReceiptPanel
            errorMessage={receiptErrorMessage}
            isPending={createReceiptMutation.isPending}
            onSubmit={(values) => createReceiptMutation.mutateAsync(values)}
            successMessage={receiptSuccessMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanReceivePanel />
        </Grid>
        <Grid size={{ xs: 12, xl: 4 }}>
          <ScanPutawayPanel />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ExceptionLane
            columns={[
              {
                header: "PO",
                key: "po",
                render: (row) => <RecordLink to={`/inbound/purchase-orders/${row.id}`}>{row.po_number}</RecordLink>,
              },
              { header: "Supplier", key: "supplier", render: (row) => row.supplier_name },
              { header: "Expected arrival", key: "arrival", render: (row) => formatDateTime(row.expected_arrival_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            emptyMessage="No overdue receipts."
            error={overduePurchaseOrdersQuery.error ? parseApiError(overduePurchaseOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={overduePurchaseOrdersQuery.isLoading}
            rows={(overduePurchaseOrdersQuery.data?.results ?? []).filter((row) =>
              ["OPEN", "PARTIAL"].includes(row.status),
            )}
            severity="warning"
            subtitle="Purchase orders whose expected arrival date has already passed and still need dock attention."
            title="Overdue receipts"
          />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ResourceTable
            columns={[
              { header: "PO", key: "po", render: (row) => <RecordLink to={`/inbound/purchase-orders/${row.id}`}>{row.po_number}</RecordLink> },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Supplier", key: "supplier", render: (row) => row.supplier_name },
              { header: "Expected arrival", key: "arrival", render: (row) => formatDateTime(row.expected_arrival_date) },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={purchaseOrdersQuery.error ? parseApiError(purchaseOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={purchaseOrdersQuery.isLoading}
            pagination={{
              page: purchaseOrdersView.page,
              pageSize: purchaseOrdersView.pageSize,
              total: purchaseOrdersQuery.data?.count ?? 0,
              onPageChange: purchaseOrdersView.setPage,
            }}
            rows={purchaseOrdersQuery.data?.results ?? []}
            subtitle="Inbound demand waiting to be received"
            title="Purchase orders"
            toolbar={
              <DataViewToolbar
                activeFilterCount={purchaseOrdersView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={purchaseOrderFields}
                filters={purchaseOrdersView.filters}
                onChange={purchaseOrdersView.updateFilter}
                onReset={purchaseOrdersView.resetFilters}
                resultCount={purchaseOrdersQuery.data?.count}
                savedViews={{
                  items: purchaseOrdersView.savedViews,
                  selectedId: purchaseOrdersView.selectedSavedViewId,
                  onApply: purchaseOrdersView.applySavedView,
                  onDelete: purchaseOrdersView.deleteSavedView,
                  onSave: purchaseOrdersView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
        <Grid size={{ xs: 12, xl: 6 }}>
          <ResourceTable
            columns={[
              { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
              { header: "PO", key: "po", render: (row) => row.purchase_order_number },
              { header: "ASN", key: "asn", render: (row) => row.asn_number || "--" },
              { header: "Location", key: "location", render: (row) => row.receipt_location_code },
              { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
            ]}
            error={receiptsQuery.error ? parseApiError(receiptsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={receiptsQuery.isLoading}
            pagination={{
              page: receiptsView.page,
              pageSize: receiptsView.pageSize,
              total: receiptsQuery.data?.count ?? 0,
              onPageChange: receiptsView.setPage,
            }}
            rows={receiptsQuery.data?.results ?? []}
            subtitle="Receipt transactions already posted"
            title="Receipts"
            toolbar={
              <DataViewToolbar
                activeFilterCount={receiptsView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={receiptFields}
                filters={receiptsView.filters}
                onChange={receiptsView.updateFilter}
                onReset={receiptsView.resetFilters}
                resultCount={receiptsQuery.data?.count}
                savedViews={{
                  items: receiptsView.savedViews,
                  selectedId: receiptsView.selectedSavedViewId,
                  onApply: receiptsView.applySavedView,
                  onDelete: receiptsView.deleteSavedView,
                  onSave: receiptsView.saveCurrentView,
                }}
              />
            }
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
            error={putawayTasksQuery.error ? parseApiError(putawayTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={putawayTasksQuery.isLoading}
            pagination={{
              page: putawayTasksView.page,
              pageSize: putawayTasksView.pageSize,
              total: putawayTasksQuery.data?.count ?? 0,
              onPageChange: putawayTasksView.setPage,
            }}
            rows={putawayTasksQuery.data?.results ?? []}
            subtitle="Putaway execution queue"
            title="Putaway tasks"
            toolbar={
              <DataViewToolbar
                activeFilterCount={putawayTasksView.activeFilterCount}
                contextLabel={activeWarehouse ? `Warehouse: ${activeWarehouse.warehouse_name}` : "All warehouses"}
                fields={putawayFields}
                filters={putawayTasksView.filters}
                onChange={putawayTasksView.updateFilter}
                onReset={putawayTasksView.resetFilters}
                resultCount={putawayTasksQuery.data?.count}
                savedViews={{
                  items: putawayTasksView.savedViews,
                  selectedId: putawayTasksView.selectedSavedViewId,
                  onApply: putawayTasksView.applySavedView,
                  onDelete: putawayTasksView.deleteSavedView,
                  onSave: putawayTasksView.saveCurrentView,
                }}
              />
            }
          />
        </Grid>
      </Grid>
    </Stack>
  );
}
