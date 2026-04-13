import Grid from "@mui/material/Grid";
import { Box, Button, Stack } from "@mui/material";
import { useSearchParams } from "react-router-dom";

import { useI18n } from "@/app/ui-preferences";
import {
  useCreateShipmentController,
  useOutboundController,
  useShortPickResolveController,
} from "@/features/outbound/controller/useOutboundController";
import { CreateShipmentPanel } from "@/features/outbound/view/components/CreateShipmentPanel";
import { GenerateWavePanel } from "@/features/outbound/view/components/GenerateWavePanel";
import { PackageExecutionPanel } from "@/features/outbound/view/components/PackageExecutionPanel";
import { ScanPickPanel } from "@/features/outbound/view/components/ScanPickPanel";
import { ScanShipPanel } from "@/features/outbound/view/components/ScanShipPanel";
import { ShipmentDocumentPanel } from "@/features/outbound/view/components/ShipmentDocumentPanel";
import { TrackLogisticsPanel } from "@/features/outbound/view/components/TrackLogisticsPanel";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ExceptionLane } from "@/shared/components/exception-lane";
import { MetricCard } from "@/shared/components/metric-card";
import { PageHeader } from "@/shared/components/page-header";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusBucketNav } from "@/shared/components/status-bucket-nav";
import { StatusChip } from "@/shared/components/status-chip";
import { useScrollToHash } from "@/shared/hooks/use-scroll-to-hash";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

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
      { label: "Posted", value: "POSTED" },
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

function formatExceptionState(exceptionState?: string) {
  if (!exceptionState || exceptionState === "NORMAL") {
    return "--";
  }

  return exceptionState.split("_").join(" ");
}

export function OutboundPage() {
  const [searchParams] = useSearchParams();
  const { t } = useI18n();
  useScrollToHash();

  const createShipment = useCreateShipmentController();
  const resolveShortPick = useShortPickResolveController();
  const {
    activeWarehouse,
    abnormalPackagesQuery,
    dockLoadVerificationsQuery,
    dockLoadView,
    interceptionOrdersQuery,
    manifestDocumentsQuery,
    packageExecutionsQuery,
    photoDocumentsQuery,
    pickTasksQuery,
    pickTasksView,
    salesOrdersQuery,
    salesOrdersView,
    salesOrderStatusCounts,
    scanformDocumentsQuery,
    shipmentsQuery,
    shipmentsView,
    shortPicksQuery,
    trackingEventsQuery,
    wavesQuery,
  } = useOutboundController({
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
    initialPickTaskFilters: {
      task_number__icontains: searchParams.get("pickTaskNumber") ?? "",
      status: searchParams.get("pickTaskStatus") ?? "",
      status__in: searchParams.get("pickTaskStatuses") ?? "",
    },
    initialShipmentFilters: {
      shipment_number__icontains: searchParams.get("shipmentNumber") ?? "",
      status: searchParams.get("shipmentStatus") ?? "",
    },
    initialDockLoadFilters: {
      search: searchParams.get("dockLoadSearch") ?? "",
      status: searchParams.get("dockLoadStatus") ?? "",
    },
  });

  return (
    <Stack spacing={3}>
      <PageHeader
        description="Manage stock-out packages, wave generation, package scan steps, shipping documents, and logistics tracking from one outbound workbench."
        title="Outbound operations"
      />
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            helper={activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
            label="Package queue"
            to="#package-management"
            tone="warning"
            value={salesOrdersQuery.data?.count ?? "--"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            helper={t("Open pick work before packing and ship confirmation.")}
            label="Secondary picking tasks"
            to="#secondary-picking"
            tone="warning"
            value={pickTasksQuery.data?.count ?? "--"}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            helper={t("Held or abnormal outbound orders that need operator follow-up.")}
            label="Outbound exceptions"
            to="#abnormal-package"
            tone="danger"
            value={(abnormalPackagesQuery.data?.count ?? 0) + (interceptionOrdersQuery.data?.count ?? 0)}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, xl: 3 }}>
          <MetricCard
            helper={t("Posted shipment records ready for handover and tracking.")}
            label="Shipping records"
            to="#shipping-manage"
            tone="success"
            value={shipmentsQuery.data?.count ?? "--"}
          />
        </Grid>
      </Grid>
      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <GenerateWavePanel />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <CreateShipmentPanel
            errorMessage={createShipment.errorMessage}
            isPending={createShipment.mutation.isPending}
            onSubmit={(values) => createShipment.mutation.mutateAsync(values)}
            successMessage={createShipment.successMessage}
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <ScanPickPanel />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 3 }}>
          <ScanShipPanel />
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <PackageExecutionPanel
            description="Confirm package consolidation and carton completion before shipment handover."
            stepType="PACK"
            submitLabel="Record pack"
            title="Scan to pack"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <PackageExecutionPanel
            description="Record second-pass inspection and flag anomalies before outbound release."
            stepType="INSPECT"
            submitLabel="Record inspection"
            title="Scan to inspect"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <PackageExecutionPanel
            description="Capture ship weight and finalize packages for the to-ship queue."
            stepType="WEIGH"
            submitLabel="Record weight"
            title="Weighing to ship"
          />
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <ShipmentDocumentPanel
            description="Generate shipment manifests for driver handover and route control."
            documentType="MANIFEST"
            submitLabel="Generate manifest"
            title="Manifest record"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <ShipmentDocumentPanel
            description="Capture outbound photo evidence and associate it with the order or shipment."
            documentType="PHOTO"
            submitLabel="Generate photo record"
            title="Photo record"
          />
        </Grid>
        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <ShipmentDocumentPanel
            description="Generate scan forms and mark waybill print activity for outbound packages."
            documentType="SCANFORM"
            submitLabel="Generate scanform"
            title="Get scanform"
          />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <TrackLogisticsPanel />
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="short-picks">
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
                      disabled={resolveShortPick.mutation.isPending}
                      onClick={() => resolveShortPick.mutation.mutate(row.id)}
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
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="interception-manage">
            <ResourceTable
              columns={[
                { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
                { header: "Customer", key: "customer", render: (row) => row.customer_name },
                { header: "Stage", key: "stage", render: (row) => row.fulfillment_stage || "--" },
                { header: "Notes", key: "notes", render: (row) => row.exception_notes || row.notes || "--" },
              ]}
              error={interceptionOrdersQuery.error ? parseApiError(interceptionOrdersQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={interceptionOrdersQuery.isLoading}
              rows={interceptionOrdersQuery.data?.results ?? []}
              subtitle="Orders explicitly held from outbound release."
              title="Interception manage"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="abnormal-package">
            <ResourceTable
              columns={[
                { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
                { header: "Customer", key: "customer", render: (row) => row.customer_name },
                { header: "Issue", key: "issue", render: (row) => formatExceptionState(row.exception_state) },
                { header: "Notes", key: "notes", render: (row) => row.exception_notes || row.notes || "--" },
              ]}
              error={abnormalPackagesQuery.error ? parseApiError(abnormalPackagesQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={abnormalPackagesQuery.isLoading}
              rows={abnormalPackagesQuery.data?.results ?? []}
              subtitle="Packages flagged by inspection, weighing, or short-pick anomalies."
              title="Abnormal package"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="package-management">
            <ResourceTable
              columns={[
                { header: "Order", key: "order", render: (row) => <RecordLink to={`/outbound/sales-orders/${row.id}`}>{row.order_number}</RecordLink> },
                { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
                { header: "Customer", key: "customer", render: (row) => row.customer_name },
                { header: "Packages", key: "packages", align: "right", render: (row) => row.package_count ?? 0 },
                { header: "Logistics", key: "logistics", render: (row) => row.logistics_provider || "--" },
                { header: "Shipping method", key: "shippingMethod", render: (row) => row.shipping_method || "--" },
                { header: "Tracking", key: "tracking", render: (row) => row.tracking_number || "--" },
                { header: "Stage", key: "stage", render: (row) => row.fulfillment_stage || "--" },
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
              subtitle="Package management and stock-out order queue for the selected warehouse."
              title="Package management"
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
                    onChange={(value) => {
                      salesOrdersView.updateFilter("status__in", "");
                      salesOrdersView.updateFilter("status", value === "ALL" ? "" : value);
                    }}
                  />
                  <DataViewToolbar
                    activeFilterCount={salesOrdersView.activeFilterCount}
                    contextLabel={activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="stock-out-package">
            <ResourceTable
              columns={[
                { header: "Record", key: "record", render: (row) => row.record_number },
                { header: "Order", key: "order", render: (row) => row.order_number },
                { header: "Package", key: "package", render: (row) => row.package_number },
                { header: "Step", key: "step", render: (row) => row.step_type },
                { header: "Status", key: "status", render: (row) => row.execution_status },
                { header: "Weight", key: "weight", align: "right", render: (row) => row.weight ?? "--" },
                { header: "Executed at", key: "executedAt", render: (row) => formatDateTime(row.executed_at) },
              ]}
              error={packageExecutionsQuery.error ? parseApiError(packageExecutionsQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={packageExecutionsQuery.isLoading}
              rows={packageExecutionsQuery.data?.results ?? []}
              subtitle="Stock-out package execution across pack, inspect, and weigh steps."
              title="Stock-out package"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="wave-management">
            <ResourceTable
              columns={[
                { header: "Wave", key: "wave", render: (row) => row.wave_number },
                { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
                { header: "Orders", key: "orders", align: "right", render: (row) => row.order_count },
                { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
                { header: "Generated by", key: "generatedBy", render: (row) => row.generated_by },
                { header: "Generated at", key: "generatedAt", render: (row) => formatDateTime(row.generated_at) },
              ]}
              error={wavesQuery.error ? parseApiError(wavesQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={wavesQuery.isLoading}
              rows={wavesQuery.data?.results ?? []}
              subtitle="Wave management for grouped outbound release and secondary picking coordination."
              title="Wave management"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="secondary-picking">
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
              subtitle="Secondary picking queue and final staging work before packing."
              title="Secondary picking"
              toolbar={
                <DataViewToolbar
                  activeFilterCount={pickTasksView.activeFilterCount}
                  contextLabel={activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
          </Box>
        </Grid>

        <Grid size={{ xs: 12, xl: 6 }}>
          <Box id="shipping-manage">
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
              subtitle="Shipping management and shipment confirmations ready for carrier handover."
              title="Shipping manage"
              toolbar={
                <DataViewToolbar
                  activeFilterCount={shipmentsView.activeFilterCount}
                  contextLabel={activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Box id="manifest-record">
            <ResourceTable
              columns={[
                { header: "Document", key: "document", render: (row) => row.document_number },
                { header: "Order", key: "order", render: (row) => row.order_number },
                { header: "Shipment", key: "shipment", render: (row) => row.shipment_number || "--" },
                { header: "File", key: "file", render: (row) => row.file_name || "--" },
                { header: "Generated at", key: "generatedAt", render: (row) => formatDateTime(row.generated_at) },
              ]}
              error={manifestDocumentsQuery.error ? parseApiError(manifestDocumentsQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={manifestDocumentsQuery.isLoading}
              rows={manifestDocumentsQuery.data?.results ?? []}
              subtitle="Recently generated outbound manifests."
              title="Manifest record"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Box id="photo-record">
            <ResourceTable
              columns={[
                { header: "Document", key: "document", render: (row) => row.document_number },
                { header: "Order", key: "order", render: (row) => row.order_number },
                { header: "Shipment", key: "shipment", render: (row) => row.shipment_number || "--" },
                { header: "File", key: "file", render: (row) => row.file_name || "--" },
                { header: "Generated at", key: "generatedAt", render: (row) => formatDateTime(row.generated_at) },
              ]}
              error={photoDocumentsQuery.error ? parseApiError(photoDocumentsQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={photoDocumentsQuery.isLoading}
              rows={photoDocumentsQuery.data?.results ?? []}
              subtitle="Outbound photo evidence attached to packages and shipments."
              title="Photo record"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12, md: 6, xl: 4 }}>
          <Box id="get-scanform">
            <ResourceTable
              columns={[
                { header: "Document", key: "document", render: (row) => row.document_number },
                { header: "Order", key: "order", render: (row) => row.order_number },
                { header: "Reference", key: "reference", render: (row) => row.reference_code || "--" },
                { header: "File", key: "file", render: (row) => row.file_name || "--" },
                { header: "Generated at", key: "generatedAt", render: (row) => formatDateTime(row.generated_at) },
              ]}
              error={scanformDocumentsQuery.error ? parseApiError(scanformDocumentsQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={scanformDocumentsQuery.isLoading}
              rows={scanformDocumentsQuery.data?.results ?? []}
              subtitle="Scan forms and waybill print records for outbound packages."
              title="Get scanform"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="logistics-tracking">
            <ResourceTable
              columns={[
                { header: "Event", key: "event", render: (row) => row.event_number },
                { header: "Tracking", key: "tracking", render: (row) => row.tracking_number },
                { header: "Order", key: "order", render: (row) => row.order_number },
                { header: "Shipment", key: "shipment", render: (row) => row.shipment_number || "--" },
                { header: "Status", key: "status", render: (row) => row.event_status },
                { header: "Location", key: "location", render: (row) => row.event_location || "--" },
                { header: "Occurred at", key: "occurredAt", render: (row) => formatDateTime(row.occurred_at) },
              ]}
              error={trackingEventsQuery.error ? parseApiError(trackingEventsQuery.error) : null}
              getRowId={(row) => row.id}
              isLoading={trackingEventsQuery.isLoading}
              rows={trackingEventsQuery.data?.results ?? []}
              subtitle="Logistics tracking milestones recorded after outbound handover."
              title="Logistics tracking"
            />
          </Box>
        </Grid>

        <Grid size={{ xs: 12 }}>
          <Box id="dock-load">
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
                  contextLabel={activeWarehouse ? msg("shell.warehouseChip", { label: activeWarehouse.warehouse_name }) : t("All warehouses")}
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
          </Box>
        </Grid>
      </Grid>
    </Stack>
  );
}
