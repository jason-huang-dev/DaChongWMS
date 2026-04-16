import type { ReactNode } from "react";

import { Chip, Stack } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import { useInboundController } from "@/features/inbound/controller/useInboundController";
import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { ScanSignPanel } from "@/features/inbound/view/components/ScanSignPanel";
import { StockInImportPanel } from "@/features/inbound/view/components/StockInImportPanel";
import { StockInListManagementSection as StockInListManagementTable } from "@/features/inbound/view/components/StockInListManagementSection";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

export const standardStockInTabItems = [
  { label: "Stock-in List Management", value: "stock-in-list-management" },
  { label: "Scan to Sign", value: "scan-to-sign" },
  { label: "Scan to Receive", value: "scan-to-receive" },
  { label: "Scan to List", value: "scan-to-list" },
] as const;

export type StandardStockInTabValue = (typeof standardStockInTabItems)[number]["value"];

export const importTabItems = [
  { label: "Import to Stock-in", value: "import-to-stock-in" },
  { label: "Import Management", value: "import-management" },
] as const;

export type ImportTabValue = (typeof importTabItems)[number]["value"];

export const returnsTabItems = [{ label: "Return order management", value: "return-order-management" }] as const;

export type ReturnsTabValue = (typeof returnsTabItems)[number]["value"];

export const recordTabItems = [
  { label: "Stock-in Record", value: "stock-in-record" },
  { label: "Signing Record", value: "signing-record" },
  { label: "Receiving Record", value: "receiving-record" },
  { label: "Listing Record", value: "listing-record" },
] as const;

export type RecordTabValue = (typeof recordTabItems)[number]["value"];

type InboundWorkspaceControllerState = ReturnType<typeof useInboundController>;

const asnFields: DataViewFieldConfig<{ asn_number__icontains: string; status: string }>[] = [
  { key: "asn_number__icontains", label: "ASN", placeholder: "ASN-1001" },
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
      { label: "Posted", value: "POSTED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const signingFields: DataViewFieldConfig<{ signing_number__icontains: string; carrier_name__icontains: string }>[] = [
  { key: "signing_number__icontains", label: "Signing number", placeholder: "SIGN-1001" },
  { key: "carrier_name__icontains", label: "Carrier", placeholder: "DHL" },
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

const importBatchFields: DataViewFieldConfig<{ batch_number__icontains: string; status: string }>[] = [
  { key: "batch_number__icontains", label: "Batch", placeholder: "IMP-20260322" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Processing", value: "PROCESSING" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Completed with errors", value: "COMPLETED_WITH_ERRORS" },
      { label: "Failed", value: "FAILED" },
    ],
  },
];

const returnOrderFields: DataViewFieldConfig<{ return_number__icontains: string; status: string }>[] = [
  { key: "return_number__icontains", label: "Return", placeholder: "RMA-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Partial received", value: "PARTIAL_RECEIVED" },
      { label: "Received", value: "RECEIVED" },
      { label: "Partial disposed", value: "PARTIAL_DISPOSED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

function warehouseContextLabel(
  activeWarehouse: InboundWorkspaceControllerState["activeWarehouse"],
  msg: ReturnType<typeof useI18n>["msg"],
  t: ReturnType<typeof useI18n>["t"],
) {
  return activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses");
}

export function StockInListManagementSection({
  controller,
  toolbarActions,
}: {
  controller: InboundWorkspaceControllerState;
  toolbarActions?: ReactNode;
}) {
  const { activeWarehouse, purchaseOrdersQuery, purchaseOrdersView } = controller;

  return (
    <StockInListManagementTable
      activeWarehouse={activeWarehouse}
      purchaseOrdersQuery={purchaseOrdersQuery}
      purchaseOrdersView={purchaseOrdersView}
      toolbarActions={toolbarActions}
    />
  );
}

export function ScanToSignSection() {
  return <ScanSignPanel />;
}

export function ScanToReceiveSection() {
  return <ScanReceivePanel />;
}

export function ScanToListSection() {
  return <ScanPutawayPanel />;
}

export function ImportToStockInSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { importBatchErrorMessage, importBatchMutation, importBatchSuccessMessage } = controller;

  return (
    <StockInImportPanel
      errorMessage={importBatchErrorMessage}
      isPending={importBatchMutation.isPending}
      onSubmit={(file) => importBatchMutation.mutateAsync(file)}
      showHeader={false}
      successMessage={importBatchSuccessMessage}
    />
  );
}

export function ImportManagementSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t } = useI18n();
  const { importBatchesQuery, importBatchesView } = controller;

  return (
    <ResourceTable
      columns={[
        { header: "Batch", key: "batch", render: (row) => row.batch_number },
        { header: "File", key: "file", render: (row) => row.file_name },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
        { header: "Rows", key: "rows", align: "right", render: (row) => formatNumber(row.total_rows) },
        { header: "Success", key: "success", align: "right", render: (row) => formatNumber(row.success_rows) },
        { header: "Failed", key: "failed", align: "right", render: (row) => formatNumber(row.failed_rows) },
        { header: "Imported", key: "imported", render: (row) => formatDateTime(row.imported_at) },
      ]}
      error={importBatchesQuery.error ? parseApiError(importBatchesQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={importBatchesQuery.isLoading}
      pagination={{
        page: importBatchesView.page,
        pageSize: importBatchesView.pageSize,
        total: importBatchesQuery.data?.count ?? 0,
        onPageChange: importBatchesView.setPage,
      }}
      rows={importBatchesQuery.data?.results ?? []}
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={importBatchesView.activeFilterCount}
          contextLabel={t("Tenant-wide imports")}
          fields={importBatchFields}
          filters={importBatchesView.filters}
          onChange={importBatchesView.updateFilter}
          onReset={importBatchesView.resetFilters}
          resultCount={importBatchesQuery.data?.count}
          savedViews={{
            items: importBatchesView.savedViews,
            selectedId: importBatchesView.selectedSavedViewId,
            onApply: importBatchesView.applySavedView,
            onDelete: importBatchesView.deleteSavedView,
            onSave: importBatchesView.saveCurrentView,
          }}
        />
      }
    />
  );
}

export function ReturnOrderManagementSection({
  controller,
  toolbarActions,
}: {
  controller: InboundWorkspaceControllerState;
  toolbarActions?: ReactNode;
}) {
  const { t, msg } = useI18n();
  const { activeWarehouse, returnOrdersQuery, returnOrdersView } = controller;

  return (
    <ResourceTable
      columns={[
        {
          header: "Return",
          key: "return",
          render: (row) => <RecordLink to={`/returns/return-orders/${row.id}`}>{row.return_number}</RecordLink>,
        },
        { header: "Customer", key: "customer", render: (row) => row.customer_name },
        { header: "Sales order", key: "salesOrder", render: (row) => row.sales_order_number || "--" },
        { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_date) },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
      ]}
      error={returnOrdersQuery.error ? parseApiError(returnOrdersQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={returnOrdersQuery.isLoading}
      pagination={{
        page: returnOrdersView.page,
        pageSize: returnOrdersView.pageSize,
        total: returnOrdersQuery.data?.count ?? 0,
        onPageChange: returnOrdersView.setPage,
      }}
      rows={returnOrdersQuery.data?.results ?? []}
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={returnOrdersView.activeFilterCount}
          contextLabel={warehouseContextLabel(activeWarehouse, msg, t)}
          fields={returnOrderFields}
          filters={returnOrdersView.filters}
          onChange={returnOrdersView.updateFilter}
          onReset={returnOrdersView.resetFilters}
          resultCount={returnOrdersQuery.data?.count}
          savedViews={{
            items: returnOrdersView.savedViews,
            selectedId: returnOrdersView.selectedSavedViewId,
            onApply: returnOrdersView.applySavedView,
            onDelete: returnOrdersView.deleteSavedView,
            onSave: returnOrdersView.saveCurrentView,
          }}
        />
      }
      toolbarActions={toolbarActions}
    />
  );
}

export function DockExceptionsSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t } = useI18n();
  const { overduePurchaseOrdersQuery } = controller;
  const overdueRows = (overduePurchaseOrdersQuery.data?.results ?? []).filter((row) => ["OPEN", "PARTIAL"].includes(row.status));

  return (
    <ResourceTable
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
      compact
      emptyMessage="No overdue receipts."
      error={overduePurchaseOrdersQuery.error ? parseApiError(overduePurchaseOrdersQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={overduePurchaseOrdersQuery.isLoading}
      rows={overdueRows}
      toolbar={
        <Stack direction="row" spacing={1}>
          <Chip color="warning" label="Dock exceptions" size="small" />
          <Chip label={t("ui.itemsCount", { count: overdueRows.length })} size="small" variant="outlined" />
        </Stack>
      }
    />
  );
}

export function StockInRecordSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t, msg } = useI18n();
  const { activeWarehouse, advanceShipmentNoticesQuery, advanceShipmentNoticesView } = controller;

  return (
    <ResourceTable
      columns={[
        { header: "ASN", key: "asn", render: (row) => row.asn_number },
        { header: "PO", key: "po", render: (row) => row.purchase_order_number },
        { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
        { header: "Supplier", key: "supplier", render: (row) => row.supplier_name },
        { header: "Expected arrival", key: "arrival", render: (row) => formatDateTime(row.expected_arrival_date) },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
      ]}
      error={advanceShipmentNoticesQuery.error ? parseApiError(advanceShipmentNoticesQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={advanceShipmentNoticesQuery.isLoading}
      pagination={{
        page: advanceShipmentNoticesView.page,
        pageSize: advanceShipmentNoticesView.pageSize,
        total: advanceShipmentNoticesQuery.data?.count ?? 0,
        onPageChange: advanceShipmentNoticesView.setPage,
      }}
      rows={advanceShipmentNoticesQuery.data?.results ?? []}
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={advanceShipmentNoticesView.activeFilterCount}
          contextLabel={warehouseContextLabel(activeWarehouse, msg, t)}
          fields={asnFields}
          filters={advanceShipmentNoticesView.filters}
          onChange={advanceShipmentNoticesView.updateFilter}
          onReset={advanceShipmentNoticesView.resetFilters}
          resultCount={advanceShipmentNoticesQuery.data?.count}
          savedViews={{
            items: advanceShipmentNoticesView.savedViews,
            selectedId: advanceShipmentNoticesView.selectedSavedViewId,
            onApply: advanceShipmentNoticesView.applySavedView,
            onDelete: advanceShipmentNoticesView.deleteSavedView,
            onSave: advanceShipmentNoticesView.saveCurrentView,
          }}
        />
      }
    />
  );
}

export function SigningRecordSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t, msg } = useI18n();
  const { activeWarehouse, signingRecordsQuery, signingRecordsView } = controller;

  return (
    <ResourceTable
      columns={[
        { header: "Signing", key: "signing", render: (row) => row.signing_number },
        { header: "PO", key: "po", render: (row) => row.purchase_order_number },
        { header: "ASN", key: "asn", render: (row) => row.asn_number || "--" },
        { header: "Carrier", key: "carrier", render: (row) => row.carrier_name || "--" },
        { header: "Vehicle", key: "vehicle", render: (row) => row.vehicle_plate || "--" },
        { header: "Signed by", key: "signedBy", render: (row) => row.signed_by },
        { header: "Signed at", key: "signedAt", render: (row) => formatDateTime(row.signed_at) },
      ]}
      error={signingRecordsQuery.error ? parseApiError(signingRecordsQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={signingRecordsQuery.isLoading}
      pagination={{
        page: signingRecordsView.page,
        pageSize: signingRecordsView.pageSize,
        total: signingRecordsQuery.data?.count ?? 0,
        onPageChange: signingRecordsView.setPage,
      }}
      rows={signingRecordsQuery.data?.results ?? []}
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={signingRecordsView.activeFilterCount}
          contextLabel={warehouseContextLabel(activeWarehouse, msg, t)}
          fields={signingFields}
          filters={signingRecordsView.filters}
          onChange={signingRecordsView.updateFilter}
          onReset={signingRecordsView.resetFilters}
          resultCount={signingRecordsQuery.data?.count}
          savedViews={{
            items: signingRecordsView.savedViews,
            selectedId: signingRecordsView.selectedSavedViewId,
            onApply: signingRecordsView.applySavedView,
            onDelete: signingRecordsView.deleteSavedView,
            onSave: signingRecordsView.saveCurrentView,
          }}
        />
      }
    />
  );
}

export function ReceivingRecordSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t, msg } = useI18n();
  const { activeWarehouse, receiptsQuery, receiptsView } = controller;

  return (
    <ResourceTable
      columns={[
        { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
        { header: "PO", key: "po", render: (row) => row.purchase_order_number },
        { header: "ASN", key: "asn", render: (row) => row.asn_number || "--" },
        { header: "Location", key: "location", render: (row) => row.receipt_location_code },
        { header: "Received", key: "received", render: (row) => formatDateTime(row.received_at) },
        { header: "By", key: "receivedBy", render: (row) => row.received_by },
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
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={receiptsView.activeFilterCount}
          contextLabel={warehouseContextLabel(activeWarehouse, msg, t)}
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
  );
}

export function ListingRecordSection({ controller }: { controller: InboundWorkspaceControllerState }) {
  const { t, msg } = useI18n();
  const { activeWarehouse, putawayTasksQuery, putawayTasksView } = controller;

  return (
    <ResourceTable
      columns={[
        { header: "Task", key: "task", render: (row) => row.task_number },
        { header: "Receipt", key: "receipt", render: (row) => row.receipt_number },
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
      compact
      toolbar={
        <DataViewToolbar
          activeFilterCount={putawayTasksView.activeFilterCount}
          contextLabel={warehouseContextLabel(activeWarehouse, msg, t)}
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
  );
}
