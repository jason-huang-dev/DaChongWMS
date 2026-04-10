import Grid from "@mui/material/Grid";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useNavigate, useSearchParams } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useInboundController } from "@/features/inbound/controller/useInboundController";
import { CreateReceiptPanel } from "@/features/inbound/view/components/CreateReceiptPanel";
import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { ScanSignPanel } from "@/features/inbound/view/components/ScanSignPanel";
import { StockInImportPanel } from "@/features/inbound/view/components/StockInImportPanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import { useScrollToHash } from "@/shared/hooks/use-scroll-to-hash";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const sectionLinks = [
  { href: "#standard-stock-in", label: "Standard Stock-in" },
  { href: "#stock-in-list-management", label: "Stock-in List Management" },
  { href: "#scan-to-sign", label: "Scan to Sign" },
  { href: "#scan-to-receive", label: "Scan to Receive" },
  { href: "#scan-to-list", label: "Scan to List" },
  { href: "#import-to-stock-in", label: "Import to Stock-in" },
  { href: "#import-management", label: "Import Management" },
  { href: "#returns-to-stock-in", label: "Returns to Stock In" },
  { href: "#return-order-management", label: "Return order management" },
  { href: "#stock-in-record", label: "Stock-in Record" },
  { href: "#signing-record", label: "Signing Record" },
  { href: "#receiving-record", label: "Receiving Record" },
  { href: "#listing-record", label: "Listing Record" },
];

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

export function InboundPage() {
  const { t, translate, msg } = useI18n();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useScrollToHash();

  const {
    activeWarehouse,
    advanceShipmentNoticesQuery,
    advanceShipmentNoticesView,
    createReceiptMutation,
    importBatchErrorMessage,
    importBatchMutation,
    importBatchSuccessMessage,
    importBatchesQuery,
    importBatchesView,
    overduePurchaseOrdersQuery,
    purchaseOrdersQuery,
    purchaseOrdersView,
    putawayTasksQuery,
    putawayTasksView,
    receiptErrorMessage,
    receiptSuccessMessage,
    receiptsQuery,
    receiptsView,
    returnOrdersQuery,
    returnOrdersView,
    returnReceiptsQuery,
    signingRecordsQuery,
    signingRecordsView,
  } = useInboundController({
    initialAdvanceShipmentNoticeFilters: {
      asn_number__icontains: searchParams.get("asnNumber") ?? "",
      status: searchParams.get("asnStatus") ?? "",
      status__in: searchParams.get("asnStatuses") ?? "",
    },
    initialPurchaseOrderFilters: {
      po_number__icontains: searchParams.get("poNumber") ?? "",
      status: searchParams.get("poStatus") ?? "",
      status__in: searchParams.get("poStatuses") ?? "",
    },
    initialReceiptFilters: {
      receipt_number__icontains: searchParams.get("receiptNumber") ?? "",
      status: searchParams.get("receiptStatus") ?? "",
    },
    initialSigningRecordFilters: {
      signing_number__icontains: searchParams.get("signingNumber") ?? "",
      carrier_name__icontains: searchParams.get("carrierName") ?? "",
    },
    initialImportBatchFilters: {
      batch_number__icontains: searchParams.get("importBatchNumber") ?? "",
      status: searchParams.get("importStatus") ?? "",
    },
    initialPutawayTaskFilters: {
      task_number__icontains: searchParams.get("putawayTaskNumber") ?? "",
      status: searchParams.get("putawayStatus") ?? "",
      status__in: searchParams.get("putawayStatuses") ?? "",
    },
    initialReturnOrderFilters: {
      return_number__icontains: searchParams.get("returnNumber") ?? "",
      status: searchParams.get("returnOrderStatus") ?? "",
      status__in: searchParams.get("returnOrderStatuses") ?? "",
    },
  });

  const overdueRows = (overduePurchaseOrdersQuery.data?.results ?? []).filter((row) => ["OPEN", "PARTIAL"].includes(row.status));

  return (
    <Stack spacing={4}>
      <PageHeader
        description="One stock-in workbench for standard receipts, dock sign-off, scan-first receiving, imports, returns-to-stock, and the inbound record queues."
        title="Stock-in operations"
      />

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {sectionLinks.map((sectionLink) => (
          <Button component="a" href={sectionLink.href} key={sectionLink.href} size="small" variant="outlined">
            {t(sectionLink.label)}
          </Button>
        ))}
      </Stack>

      <Box id="standard-stock-in">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Standard Stock-in")}</Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard
                helper={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
                label="Open purchase orders"
                to="#stock-in-list-management"
                tone="warning"
                value={purchaseOrdersQuery.data?.count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Open ASNs" to="#stock-in-record" tone="info" value={advanceShipmentNoticesQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Overdue receipts" to="#standard-stock-in" tone="danger" value={overdueRows.length} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Open listing tasks" to="#listing-record" tone="warning" value={putawayTasksQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <CreateReceiptPanel
                errorMessage={receiptErrorMessage}
                isPending={createReceiptMutation.isPending}
                onSubmit={(values) => createReceiptMutation.mutateAsync(values)}
                successMessage={receiptSuccessMessage}
              />
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
                rows={overdueRows}
                severity="warning"
                subtitle="Purchase orders whose expected arrival date has already passed and still need dock attention."
                title="Dock exceptions"
              />
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Box id="stock-in-list-management">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Stock-in List Management")}</Typography>
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
            subtitle="Manage the inbound document list before receiving starts."
            title="Purchase orders"
            toolbar={
              <DataViewToolbar
                activeFilterCount={purchaseOrdersView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
        </Stack>
      </Box>

      <Box id="scan-to-sign">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Scan to Sign")}</Typography>
          <ScanSignPanel />
        </Stack>
      </Box>

      <Box id="scan-to-receive">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Scan to Receive")}</Typography>
          <ScanReceivePanel />
        </Stack>
      </Box>

      <Box id="scan-to-list">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Scan to List")}</Typography>
          <ScanPutawayPanel />
        </Stack>
      </Box>

      <Box id="import-to-stock-in">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Import to Stock-in")}</Typography>
          <StockInImportPanel
            errorMessage={importBatchErrorMessage}
            isPending={importBatchMutation.isPending}
            onSubmit={(file) => importBatchMutation.mutateAsync(file)}
            successMessage={importBatchSuccessMessage}
          />
        </Stack>
      </Box>

      <Box id="import-management">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Import Management")}</Typography>
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
            subtitle="Recent stock-in imports and row-level outcome counts."
            title="Import batches"
            toolbar={
              <DataViewToolbar
                activeFilterCount={importBatchesView.activeFilterCount}
                contextLabel="Tenant-wide imports"
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
        </Stack>
      </Box>

      <Box id="returns-to-stock-in">
        <Stack spacing={2}>
          <Stack alignItems={{ md: "center" }} direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
            <Typography variant="h5">{t("Returns to Stock In")}</Typography>
            <Button onClick={() => navigate("/returns#return-receipts")} variant="contained">
              {t("Open returns workspace")}
            </Button>
          </Stack>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Open return orders" to="#return-order-management" tone="warning" value={returnOrdersQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Posted return receipts" to="#receiving-record" tone="success" value={returnReceiptsQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 4 }}>
              <MetricCard label="Warehouse context" tone="info" value={activeWarehouse?.warehouse_name ?? "All warehouses"} />
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Box id="return-order-management">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Return order management")}</Typography>
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
            subtitle="Returns that can feed back into stock-in receipt work."
            title="Return orders"
            toolbar={
              <DataViewToolbar
                activeFilterCount={returnOrdersView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
          />
        </Stack>
      </Box>

      <Box id="stock-in-record">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Stock-in Record")}</Typography>
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
            subtitle="Inbound document records showing planned stock-in progress."
            title="Advance shipment notices"
            toolbar={
              <DataViewToolbar
                activeFilterCount={advanceShipmentNoticesView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
        </Stack>
      </Box>

      <Box id="signing-record">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Signing Record")}</Typography>
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
            subtitle="Dock sign-off records captured before warehouse receiving."
            title="Inbound signing records"
            toolbar={
              <DataViewToolbar
                activeFilterCount={signingRecordsView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
        </Stack>
      </Box>

      <Box id="receiving-record">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Receiving Record")}</Typography>
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
            subtitle="Posted stock-in receipts already accepted into the warehouse."
            title="Receipts"
            toolbar={
              <DataViewToolbar
                activeFilterCount={receiptsView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
        </Stack>
      </Box>

      <Box id="listing-record">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Listing Record")}</Typography>
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
            subtitle="Listing and putaway execution records after receiving is posted."
            title="Putaway tasks"
            toolbar={
              <DataViewToolbar
                activeFilterCount={putawayTasksView.activeFilterCount}
                contextLabel={activeWarehouse ? t("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
        </Stack>
      </Box>
    </Stack>
  );
}
