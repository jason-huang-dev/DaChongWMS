import Grid from "@mui/material/Grid";
import { Box, Button, Stack, Typography } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import { useInboundController } from "@/features/inbound/controller/useInboundController";
import { ScanPutawayPanel } from "@/features/inbound/view/components/ScanPutawayPanel";
import { ScanReceivePanel } from "@/features/inbound/view/components/ScanReceivePanel";
import { useOutboundController } from "@/features/outbound/controller/useOutboundController";
import { PackageExecutionPanel } from "@/features/outbound/view/components/PackageExecutionPanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusBucketNav } from "@/shared/components/status-bucket-nav";
import { StatusChip } from "@/shared/components/status-chip";
import { useScrollToHash } from "@/shared/hooks/use-scroll-to-hash";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const sectionLinks = [
  { href: "#b2b-stock-in", label: "B2B Stock-in" },
  { href: "#stock-in-list-management", label: "Stock-in List Management" },
  { href: "#scan-to-receive", label: "Scan to Receive" },
  { href: "#scan-to-list", label: "Scan to List" },
  { href: "#b2b-stock-out", label: "B2B Stock-out" },
  { href: "#stock-out-list-manage", label: "Stock-Out List Manage" },
  { href: "#scan-and-relabel", label: "Scan and Relabel" },
  { href: "#scan-to-pack", label: "Scan to pack" },
  { href: "#stock-in-record", label: "Stock-in Record" },
  { href: "#signing-record", label: "Signing Record" },
  { href: "#receiving-record", label: "Receiving Record" },
  { href: "#listing-record", label: "Listing Record" },
] as const;

const b2bOrderType = "B2B";

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

const salesOrderFields: DataViewFieldConfig<{
  order_number__icontains: string;
  requested_ship_date__gte: string;
  requested_ship_date__lte: string;
  status: string;
  fulfillment_stage: string;
  exception_state: string;
  waybill_printed: string;
}>[] = [
  { key: "order_number__icontains", label: "Order", placeholder: "SO-1001" },
  { key: "requested_ship_date__gte", label: "Ship from", type: "date" },
  { key: "requested_ship_date__lte", label: "Ship to", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Allocated", value: "ALLOCATED" },
      { label: "Picking", value: "PICKING" },
      { label: "Picked", value: "PICKED" },
      { label: "Shipped", value: "SHIPPED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    key: "fulfillment_stage",
    label: "Stage",
    type: "select",
    options: [
      { label: "Get tracking no", value: "GET_TRACKING_NO" },
      { label: "To move", value: "TO_MOVE" },
      { label: "In process", value: "IN_PROCESS" },
      { label: "To ship", value: "TO_SHIP" },
      { label: "Shipped", value: "SHIPPED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    key: "exception_state",
    label: "Issue",
    type: "select",
    options: [
      { label: "Abnormal package", value: "ABNORMAL_PACKAGE" },
      { label: "Order interception", value: "ORDER_INTERCEPTION" },
      { label: "Normal", value: "NORMAL" },
    ],
  },
  {
    key: "waybill_printed",
    label: "Waybill",
    type: "select",
    options: [
      { label: "Printed", value: "true" },
      { label: "Not printed", value: "false" },
    ],
  },
];

export function B2BPage() {
  const { t, translate, msg } = useI18n();
  const [searchParams] = useSearchParams();
  useScrollToHash();

  const inbound = useInboundController({
    scopeOrderType: b2bOrderType,
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
    initialPutawayTaskFilters: {
      task_number__icontains: searchParams.get("putawayTaskNumber") ?? "",
      status: searchParams.get("putawayStatus") ?? "",
      status__in: searchParams.get("putawayStatuses") ?? "",
    },
  });

  const outbound = useOutboundController({
    scopeOrderType: b2bOrderType,
    initialSalesOrderFilters: {
      order_number__icontains: searchParams.get("salesOrderNumber") ?? "",
      requested_ship_date__gte: searchParams.get("shipFrom") ?? "",
      requested_ship_date__lte: searchParams.get("shipTo") ?? "",
      status: searchParams.get("salesOrderStatus") ?? "",
      status__in: searchParams.get("salesOrderStatuses") ?? "",
      fulfillment_stage: searchParams.get("salesOrderStage") ?? "",
      exception_state: searchParams.get("salesOrderException") ?? "",
      waybill_printed: searchParams.get("waybillPrinted") ?? "",
    },
  });

  return (
    <Stack spacing={4}>
      <PageHeader
        description="B2B stock-in and stock-out workbench for scheduled customer replenishment, scan-first receiving, relabeling, packing, and record visibility."
        title="B2B operations"
      />

      <Stack direction="row" flexWrap="wrap" gap={1}>
        {sectionLinks.map((sectionLink) => (
          <Button component="a" href={sectionLink.href} key={sectionLink.href} size="small" variant="outlined">
            {t(sectionLink.label)}
          </Button>
        ))}
      </Stack>

      <Box id="b2b-stock-in">
        <Stack spacing={2}>
          <Typography variant="h5">{t("B2B Stock-in")}</Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard
                helper={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                label="Open purchase orders"
                value={inbound.purchaseOrdersQuery.data?.count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Open ASNs" value={inbound.advanceShipmentNoticesQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Posted receipts" value={inbound.receiptsQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Open listing tasks" value={inbound.putawayTasksQuery.data?.count ?? "--"} />
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
            error={inbound.purchaseOrdersQuery.error ? parseApiError(inbound.purchaseOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={inbound.purchaseOrdersQuery.isLoading}
            pagination={{
              page: inbound.purchaseOrdersView.page,
              pageSize: inbound.purchaseOrdersView.pageSize,
              total: inbound.purchaseOrdersQuery.data?.count ?? 0,
              onPageChange: inbound.purchaseOrdersView.setPage,
            }}
            rows={inbound.purchaseOrdersQuery.data?.results ?? []}
            subtitle="Manage the B2B stock-in document list before receiving starts."
            title="Purchase orders"
            toolbar={
              <DataViewToolbar
                activeFilterCount={inbound.purchaseOrdersView.activeFilterCount}
                contextLabel={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                fields={purchaseOrderFields}
                filters={inbound.purchaseOrdersView.filters}
                onChange={inbound.purchaseOrdersView.updateFilter}
                onReset={inbound.purchaseOrdersView.resetFilters}
                resultCount={inbound.purchaseOrdersQuery.data?.count}
                savedViews={{
                  items: inbound.purchaseOrdersView.savedViews,
                  selectedId: inbound.purchaseOrdersView.selectedSavedViewId,
                  onApply: inbound.purchaseOrdersView.applySavedView,
                  onDelete: inbound.purchaseOrdersView.deleteSavedView,
                  onSave: inbound.purchaseOrdersView.saveCurrentView,
                }}
              />
            }
          />
        </Stack>
      </Box>

      <Box id="scan-to-receive">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Scan to Receive")}</Typography>
          <ScanReceivePanel orderType={b2bOrderType} />
        </Stack>
      </Box>

      <Box id="scan-to-list">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Scan to List")}</Typography>
          <ScanPutawayPanel orderType={b2bOrderType} />
        </Stack>
      </Box>

      <Box id="b2b-stock-out">
        <Stack spacing={2}>
          <Typography variant="h5">{t("B2B Stock-out")}</Typography>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard
                helper={outbound.activeWarehouse ? t("shell.warehouseChip", { label: outbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                label="Sales orders"
                value={outbound.salesOrdersQuery.data?.count ?? "--"}
              />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Open pick tasks" value={outbound.pickTasksQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Package execution records" value={outbound.packageExecutionsQuery.data?.count ?? "--"} />
            </Grid>
            <Grid size={{ xs: 12, md: 3 }}>
              <MetricCard label="Shipment records" value={outbound.shipmentsQuery.data?.count ?? "--"} />
            </Grid>
          </Grid>
        </Stack>
      </Box>

      <Box id="stock-out-list-manage">
        <Stack spacing={2}>
          <Typography variant="h5">{t("Stock-Out List Manage")}</Typography>
          <ResourceTable
            columns={[
              { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
              { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
              { header: "Customer", key: "customer", render: (row) => row.customer_name },
              { header: "Packages", key: "packages", align: "right", render: (row) => row.package_count ?? 0 },
              { header: "Shipping method", key: "shippingMethod", render: (row) => row.shipping_method || "--" },
              { header: "Tracking", key: "tracking", render: (row) => row.tracking_number || "--" },
              { header: "Stage", key: "stage", render: (row) => row.fulfillment_stage || "--" },
              { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            ]}
            error={outbound.salesOrdersQuery.error ? parseApiError(outbound.salesOrdersQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={outbound.salesOrdersQuery.isLoading}
            pagination={{
              page: outbound.salesOrdersView.page,
              pageSize: outbound.salesOrdersView.pageSize,
              total: outbound.salesOrdersQuery.data?.count ?? 0,
              onPageChange: outbound.salesOrdersView.setPage,
            }}
            rows={outbound.salesOrdersQuery.data?.results ?? []}
            subtitle="Manage the B2B stock-out order queue before relabeling and packing."
            title="Sales orders"
            toolbar={
              <Stack spacing={1.5}>
                <StatusBucketNav
                  activeValue={outbound.salesOrdersView.filters.status || "ALL"}
                  items={[
                    { value: "ALL", label: "All sales orders", count: outbound.salesOrderStatusCounts.all.data?.count ?? "--" },
                    { value: "OPEN", label: "Open", count: outbound.salesOrderStatusCounts.open.data?.count ?? "--" },
                    { value: "ALLOCATED", label: "Allocated", count: outbound.salesOrderStatusCounts.allocated.data?.count ?? "--" },
                    { value: "PICKED", label: "Picked", count: outbound.salesOrderStatusCounts.picked.data?.count ?? "--" },
                    { value: "SHIPPED", label: "Shipped", count: outbound.salesOrderStatusCounts.shipped.data?.count ?? "--" },
                    { value: "CANCELLED", label: "Cancelled", count: outbound.salesOrderStatusCounts.cancelled.data?.count ?? "--" },
                  ]}
                  onChange={(value) => {
                    outbound.salesOrdersView.updateFilter("status__in", "");
                    outbound.salesOrdersView.updateFilter("status", value === "ALL" ? "" : value);
                  }}
                />
                <DataViewToolbar
                  activeFilterCount={outbound.salesOrdersView.activeFilterCount}
                  contextLabel={outbound.activeWarehouse ? t("shell.warehouseChip", { label: outbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                  fields={salesOrderFields}
                  filters={outbound.salesOrdersView.filters}
                  onChange={outbound.salesOrdersView.updateFilter}
                  onReset={outbound.salesOrdersView.resetFilters}
                  resultCount={outbound.salesOrdersQuery.data?.count}
                  savedViews={{
                    items: outbound.salesOrdersView.savedViews,
                    selectedId: outbound.salesOrdersView.selectedSavedViewId,
                    onApply: outbound.salesOrdersView.applySavedView,
                    onDelete: outbound.salesOrdersView.deleteSavedView,
                    onSave: outbound.salesOrdersView.saveCurrentView,
                  }}
                />
              </Stack>
            }
          />
        </Stack>
      </Box>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box id="scan-and-relabel">
            <PackageExecutionPanel
              description="Capture scan-and-relabel execution before packing when B2B orders require new carton or channel labels."
              orderType={b2bOrderType}
              stepType="RELABEL"
              submitLabel="Record relabel"
              title="Scan and Relabel"
            />
          </Box>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <Box id="scan-to-pack">
            <PackageExecutionPanel
              description="Capture final B2B packing confirmation before shipment release."
              orderType={b2bOrderType}
              stepType="PACK"
              submitLabel="Record pack"
              title="Scan to pack"
            />
          </Box>
        </Grid>
      </Grid>

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
            error={inbound.advanceShipmentNoticesQuery.error ? parseApiError(inbound.advanceShipmentNoticesQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={inbound.advanceShipmentNoticesQuery.isLoading}
            pagination={{
              page: inbound.advanceShipmentNoticesView.page,
              pageSize: inbound.advanceShipmentNoticesView.pageSize,
              total: inbound.advanceShipmentNoticesQuery.data?.count ?? 0,
              onPageChange: inbound.advanceShipmentNoticesView.setPage,
            }}
            rows={inbound.advanceShipmentNoticesQuery.data?.results ?? []}
            subtitle="Inbound document records showing planned B2B stock-in progress."
            title="Advance shipment notices"
            toolbar={
              <DataViewToolbar
                activeFilterCount={inbound.advanceShipmentNoticesView.activeFilterCount}
                contextLabel={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                fields={asnFields}
                filters={inbound.advanceShipmentNoticesView.filters}
                onChange={inbound.advanceShipmentNoticesView.updateFilter}
                onReset={inbound.advanceShipmentNoticesView.resetFilters}
                resultCount={inbound.advanceShipmentNoticesQuery.data?.count}
                savedViews={{
                  items: inbound.advanceShipmentNoticesView.savedViews,
                  selectedId: inbound.advanceShipmentNoticesView.selectedSavedViewId,
                  onApply: inbound.advanceShipmentNoticesView.applySavedView,
                  onDelete: inbound.advanceShipmentNoticesView.deleteSavedView,
                  onSave: inbound.advanceShipmentNoticesView.saveCurrentView,
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
            error={inbound.signingRecordsQuery.error ? parseApiError(inbound.signingRecordsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={inbound.signingRecordsQuery.isLoading}
            pagination={{
              page: inbound.signingRecordsView.page,
              pageSize: inbound.signingRecordsView.pageSize,
              total: inbound.signingRecordsQuery.data?.count ?? 0,
              onPageChange: inbound.signingRecordsView.setPage,
            }}
            rows={inbound.signingRecordsQuery.data?.results ?? []}
            subtitle="Dock signing records captured before B2B warehouse receiving."
            title="Inbound signing records"
            toolbar={
              <DataViewToolbar
                activeFilterCount={inbound.signingRecordsView.activeFilterCount}
                contextLabel={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                fields={signingFields}
                filters={inbound.signingRecordsView.filters}
                onChange={inbound.signingRecordsView.updateFilter}
                onReset={inbound.signingRecordsView.resetFilters}
                resultCount={inbound.signingRecordsQuery.data?.count}
                savedViews={{
                  items: inbound.signingRecordsView.savedViews,
                  selectedId: inbound.signingRecordsView.selectedSavedViewId,
                  onApply: inbound.signingRecordsView.applySavedView,
                  onDelete: inbound.signingRecordsView.deleteSavedView,
                  onSave: inbound.signingRecordsView.saveCurrentView,
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
            error={inbound.receiptsQuery.error ? parseApiError(inbound.receiptsQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={inbound.receiptsQuery.isLoading}
            pagination={{
              page: inbound.receiptsView.page,
              pageSize: inbound.receiptsView.pageSize,
              total: inbound.receiptsQuery.data?.count ?? 0,
              onPageChange: inbound.receiptsView.setPage,
            }}
            rows={inbound.receiptsQuery.data?.results ?? []}
            subtitle="Posted B2B stock-in receipts already accepted into the warehouse."
            title="Receipts"
            toolbar={
              <DataViewToolbar
                activeFilterCount={inbound.receiptsView.activeFilterCount}
                contextLabel={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                fields={receiptFields}
                filters={inbound.receiptsView.filters}
                onChange={inbound.receiptsView.updateFilter}
                onReset={inbound.receiptsView.resetFilters}
                resultCount={inbound.receiptsQuery.data?.count}
                savedViews={{
                  items: inbound.receiptsView.savedViews,
                  selectedId: inbound.receiptsView.selectedSavedViewId,
                  onApply: inbound.receiptsView.applySavedView,
                  onDelete: inbound.receiptsView.deleteSavedView,
                  onSave: inbound.receiptsView.saveCurrentView,
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
            error={inbound.putawayTasksQuery.error ? parseApiError(inbound.putawayTasksQuery.error) : null}
            getRowId={(row) => row.id}
            isLoading={inbound.putawayTasksQuery.isLoading}
            pagination={{
              page: inbound.putawayTasksView.page,
              pageSize: inbound.putawayTasksView.pageSize,
              total: inbound.putawayTasksQuery.data?.count ?? 0,
              onPageChange: inbound.putawayTasksView.setPage,
            }}
            rows={inbound.putawayTasksQuery.data?.results ?? []}
            subtitle="Listing and putaway execution records after B2B receiving is posted."
            title="Putaway tasks"
            toolbar={
              <DataViewToolbar
                activeFilterCount={inbound.putawayTasksView.activeFilterCount}
                contextLabel={inbound.activeWarehouse ? t("shell.warehouseChip", { label: inbound.activeWarehouse.warehouse_name }) : t("All warehouses")}
                fields={putawayFields}
                filters={inbound.putawayTasksView.filters}
                onChange={inbound.putawayTasksView.updateFilter}
                onReset={inbound.putawayTasksView.resetFilters}
                resultCount={inbound.putawayTasksQuery.data?.count}
                savedViews={{
                  items: inbound.putawayTasksView.savedViews,
                  selectedId: inbound.putawayTasksView.selectedSavedViewId,
                  onApply: inbound.putawayTasksView.applySavedView,
                  onDelete: inbound.putawayTasksView.deleteSavedView,
                  onSave: inbound.putawayTasksView.saveCurrentView,
                }}
              />
            }
          />
        </Stack>
      </Box>
    </Stack>
  );
}
