import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";

import type {
  CarrierBookingRecord,
  IntegrationJobRecord,
  IntegrationLogRecord,
  WebhookEventRecord,
} from "@/features/integrations/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const jobFields: DataViewFieldConfig<{ integration_name__icontains: string; job_type: string; status: string }>[] = [
  { key: "integration_name__icontains", label: "Integration", placeholder: "carrier" },
  { key: "job_type", label: "Job type", placeholder: "EXPORT" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Queued", value: "QUEUED" },
      { label: "Running", value: "RUNNING" },
      { label: "Succeeded", value: "SUCCEEDED" },
      { label: "Failed", value: "FAILED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const webhookFields: DataViewFieldConfig<{ event_key__icontains: string; status: string }>[] = [
  { key: "event_key__icontains", label: "Event key", placeholder: "asn.updated" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Received", value: "RECEIVED" },
      { label: "Queued", value: "QUEUED" },
      { label: "Processed", value: "PROCESSED" },
      { label: "Failed", value: "FAILED" },
      { label: "Ignored", value: "IGNORED" },
    ],
  },
];

const carrierBookingFields: DataViewFieldConfig<{ carrier_code__icontains: string; tracking_number__icontains: string; status: string }>[] = [
  { key: "carrier_code__icontains", label: "Carrier", placeholder: "UPS" },
  { key: "tracking_number__icontains", label: "Tracking", placeholder: "1Z..." },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Booked", value: "BOOKED" },
      { label: "Labeled", value: "LABELED" },
      { label: "Failed", value: "FAILED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const logFields: DataViewFieldConfig<{ level: string }>[] = [
  {
    key: "level",
    label: "Level",
    type: "select",
    options: [
      { label: "Info", value: "INFO" },
      { label: "Warning", value: "WARNING" },
      { label: "Error", value: "ERROR" },
    ],
  },
];

interface IntegrationTableProps {
  activeWarehouseName?: string | null;
  carrierBookingsQuery: PaginatedQueryState<CarrierBookingRecord>;
  carrierBookingsView: UseDataViewResult<{ carrier_code__icontains: string; tracking_number__icontains: string; status: string }>;
  completeJob: (jobId: number) => void;
  failJob: (jobId: number) => void;
  generateLabel: (bookingId: number) => void;
  isCompletingJob: boolean;
  isFailingJob: boolean;
  isGeneratingLabel: boolean;
  isProcessingWebhook: boolean;
  isStartingJob: boolean;
  jobsQuery: PaginatedQueryState<IntegrationJobRecord>;
  jobsView: UseDataViewResult<{ integration_name__icontains: string; job_type: string; status: string }>;
  logsQuery: PaginatedQueryState<IntegrationLogRecord>;
  logsView: UseDataViewResult<{ level: string }>;
  processWebhook: (webhookId: number) => void;
  startJob: (jobId: number) => void;
  webhooksQuery: PaginatedQueryState<WebhookEventRecord>;
  webhooksView: UseDataViewResult<{ event_key__icontains: string; status: string }>;
}

export function IntegrationTable({
  activeWarehouseName,
  carrierBookingsQuery,
  carrierBookingsView,
  completeJob,
  failJob,
  generateLabel,
  isCompletingJob,
  isFailingJob,
  isGeneratingLabel,
  isProcessingWebhook,
  isStartingJob,
  jobsQuery,
  jobsView,
  logsQuery,
  logsView,
  processWebhook,
  startJob,
  webhooksQuery,
  webhooksView,
}: IntegrationTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            {
              header: "Reference",
              key: "reference",
              render: (row) => (
                <RecordLink to={`/integrations/jobs/${row.id}`}>
                  {row.reference_code || `${row.integration_name} #${row.id}`}
                </RecordLink>
              ),
            },
            { header: "Integration", key: "integration", render: (row) => row.integration_name },
            { header: "Job type", key: "jobType", render: (row) => row.job_type },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            {
              header: "Actions",
              key: "actions",
              render: (row) => (
                <Grid container spacing={1}>
                  <Button disabled={isStartingJob || row.status !== "QUEUED"} onClick={() => startJob(row.id)} size="small" variant="outlined">
                    Start
                  </Button>
                  <Button disabled={isCompletingJob || row.status !== "RUNNING"} onClick={() => completeJob(row.id)} size="small" variant="contained">
                    Complete
                  </Button>
                  <Button disabled={isFailingJob || !["QUEUED", "RUNNING"].includes(row.status)} onClick={() => failJob(row.id)} size="small" variant="text">
                    Fail
                  </Button>
                </Grid>
              ),
            },
          ]}
          error={jobsQuery.error ? parseApiError(jobsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={jobsQuery.isLoading}
          pagination={{
            page: jobsView.page,
            pageSize: jobsView.pageSize,
            total: jobsQuery.data?.count ?? 0,
            onPageChange: jobsView.setPage,
          }}
          rows={jobsQuery.data?.results ?? []}
          subtitle="Manual ERP and carrier sync jobs that operators or admins can trigger from the console."
          title="Integration jobs"
          toolbar={
            <DataViewToolbar
              activeFilterCount={jobsView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={jobFields}
              filters={jobsView.filters}
              onChange={jobsView.updateFilter}
              onReset={jobsView.resetFilters}
              resultCount={jobsQuery.data?.count}
              savedViews={{
                items: jobsView.savedViews,
                selectedId: jobsView.selectedSavedViewId,
                onApply: jobsView.applySavedView,
                onDelete: jobsView.deleteSavedView,
                onSave: jobsView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            {
              header: "Event",
              key: "event",
              render: (row) => <RecordLink to={`/integrations/webhooks/${row.id}`}>{row.event_key}</RecordLink>,
            },
            { header: "Source", key: "source", render: (row) => row.source_system },
            { header: "Type", key: "type", render: (row) => row.event_type },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isProcessingWebhook || !["RECEIVED", "QUEUED", "FAILED"].includes(row.status)}
                  onClick={() => processWebhook(row.id)}
                  size="small"
                  variant="outlined"
                >
                  Process
                </Button>
              ),
            },
          ]}
          error={webhooksQuery.error ? parseApiError(webhooksQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={webhooksQuery.isLoading}
          pagination={{
            page: webhooksView.page,
            pageSize: webhooksView.pageSize,
            total: webhooksQuery.data?.count ?? 0,
            onPageChange: webhooksView.setPage,
          }}
          rows={webhooksQuery.data?.results ?? []}
          subtitle="Inbound webhooks waiting for processing or requiring retry."
          title="Webhook events"
          toolbar={
            <DataViewToolbar
              activeFilterCount={webhooksView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={webhookFields}
              filters={webhooksView.filters}
              onChange={webhooksView.updateFilter}
              onReset={webhooksView.resetFilters}
              resultCount={webhooksQuery.data?.count}
              savedViews={{
                items: webhooksView.savedViews,
                selectedId: webhooksView.selectedSavedViewId,
                onApply: webhooksView.applySavedView,
                onDelete: webhooksView.deleteSavedView,
                onSave: webhooksView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            {
              header: "Booking",
              key: "booking",
              render: (row) => <RecordLink to={`/integrations/carrier-bookings/${row.id}`}>{row.booking_number}</RecordLink>,
            },
            { header: "Carrier", key: "carrier", render: (row) => row.carrier_code },
            { header: "Tracking", key: "tracking", render: (row) => row.tracking_number || "--" },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isGeneratingLabel || row.status === "LABELED"}
                  onClick={() => generateLabel(row.id)}
                  size="small"
                  variant="contained"
                >
                  Generate label
                </Button>
              ),
            },
          ]}
          error={carrierBookingsQuery.error ? parseApiError(carrierBookingsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={carrierBookingsQuery.isLoading}
          pagination={{
            page: carrierBookingsView.page,
            pageSize: carrierBookingsView.pageSize,
            total: carrierBookingsQuery.data?.count ?? 0,
            onPageChange: carrierBookingsView.setPage,
          }}
          rows={carrierBookingsQuery.data?.results ?? []}
          subtitle="Carrier bookings and label lifecycle state."
          title="Carrier bookings"
          toolbar={
            <DataViewToolbar
              activeFilterCount={carrierBookingsView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={carrierBookingFields}
              filters={carrierBookingsView.filters}
              onChange={carrierBookingsView.updateFilter}
              onReset={carrierBookingsView.resetFilters}
              resultCount={carrierBookingsQuery.data?.count}
              savedViews={{
                items: carrierBookingsView.savedViews,
                selectedId: carrierBookingsView.selectedSavedViewId,
                onApply: carrierBookingsView.applySavedView,
                onDelete: carrierBookingsView.deleteSavedView,
                onSave: carrierBookingsView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            { header: "Logged at", key: "loggedAt", render: (row) => formatDateTime(row.logged_at) },
            { header: "Level", key: "level", render: (row) => row.level },
            { header: "Message", key: "message", render: (row) => row.message },
            {
              header: "Job",
              key: "job",
              render: (row) =>
                row.job ? <RecordLink to={`/integrations/jobs/${row.job}`}>Job {row.job}</RecordLink> : "--",
            },
            {
              header: "Webhook",
              key: "webhook",
              render: (row) =>
                row.webhook_event ? (
                  <RecordLink to={`/integrations/webhooks/${row.webhook_event}`}>Webhook {row.webhook_event}</RecordLink>
                ) : (
                  "--"
                ),
            },
          ]}
          error={logsQuery.error ? parseApiError(logsQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={logsQuery.isLoading}
          pagination={{
            page: logsView.page,
            pageSize: logsView.pageSize,
            total: logsQuery.data?.count ?? 0,
            onPageChange: logsView.setPage,
          }}
          rows={logsQuery.data?.results ?? []}
          subtitle="Execution logs emitted by integration jobs, webhooks, and carrier actions."
          title="Integration logs"
          toolbar={
            <DataViewToolbar
              activeFilterCount={logsView.activeFilterCount}
              fields={logFields}
              filters={logsView.filters}
              onChange={logsView.updateFilter}
              onReset={logsView.resetFilters}
              resultCount={logsQuery.data?.count}
              savedViews={{
                items: logsView.savedViews,
                selectedId: logsView.selectedSavedViewId,
                onApply: logsView.applySavedView,
                onDelete: logsView.deleteSavedView,
                onSave: logsView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
    </Grid>
  );
}
