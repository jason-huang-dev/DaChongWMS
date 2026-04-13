import { Button, Chip, Stack, Typography } from "@mui/material";

import { useI18n } from "@/app/ui-preferences";
import {
  getWorkOrderSlaStatusLabelKey,
  getWorkOrderStatusLabelKey,
  getWorkOrderUrgencyLabelKey,
  getWorkOrderWorkstreamLabelKey,
} from "@/features/work-orders/model/label-keys";
import type { WorkOrderRecord } from "@/features/work-orders/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";

const workOrderFields: DataViewFieldConfig<{
  search: string;
  status: string;
  urgency: string;
  workstream: string;
  sla_status: string;
  assignee_name: string;
}>[] = [
  { key: "search", label: "Search", placeholder: "WO-00001 / SO-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending review", value: "PENDING_REVIEW" },
      { label: "Ready", value: "READY" },
      { label: "Scheduled", value: "SCHEDULED" },
      { label: "In progress", value: "IN_PROGRESS" },
      { label: "Blocked", value: "BLOCKED" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    key: "urgency",
    label: "Urgency",
    type: "select",
    options: [
      { label: "Low", value: "LOW" },
      { label: "Medium", value: "MEDIUM" },
      { label: "High", value: "HIGH" },
      { label: "Critical", value: "CRITICAL" },
    ],
  },
  {
    key: "workstream",
    label: "Workstream",
    type: "select",
    options: [
      { label: "Inbound", value: "INBOUND" },
      { label: "Outbound", value: "OUTBOUND" },
      { label: "Inventory", value: "INVENTORY" },
      { label: "Returns", value: "RETURNS" },
      { label: "General", value: "GENERAL" },
    ],
  },
  {
    key: "sla_status",
    label: "SLA",
    type: "select",
    options: [
      { label: "Unscheduled", value: "UNSCHEDULED" },
      { label: "On track", value: "ON_TRACK" },
      { label: "Due soon", value: "DUE_SOON" },
      { label: "Overdue", value: "OVERDUE" },
      { label: "Completed", value: "COMPLETED" },
    ],
  },
  { key: "assignee_name", label: "Assignee", placeholder: "Shift A" },
];

function formatDateTime(value: string | null) {
  if (!value) {
    return "--";
  }
  return new Date(value).toLocaleString();
}

function urgencyChipColor(urgency: string): "default" | "success" | "warning" | "error" {
  switch (urgency) {
    case "LOW":
      return "success";
    case "HIGH":
      return "warning";
    case "CRITICAL":
      return "error";
    default:
      return "default";
  }
}

function slaChipColor(slaStatus: string): "default" | "success" | "warning" | "error" {
  switch (slaStatus) {
    case "ON_TRACK":
      return "success";
    case "DUE_SOON":
      return "warning";
    case "OVERDUE":
      return "error";
    default:
      return "default";
  }
}

interface WorkOrderTableProps {
  workOrders: WorkOrderRecord[];
  total: number;
  isLoading: boolean;
  error?: string | null;
  companyLabel?: string | null;
  activeWarehouseName?: string | null;
  dataView: UseDataViewResult<{
    search: string;
    status: string;
    urgency: string;
    workstream: string;
    sla_status: string;
    assignee_name: string;
  }>;
  onEdit: (workOrder: WorkOrderRecord) => void;
}

export function WorkOrderTable({
  workOrders,
  total,
  isLoading,
  error,
  companyLabel,
  activeWarehouseName,
  dataView,
  onEdit,
}: WorkOrderTableProps) {
  const { t, translate, msg } = useI18n();
  const contextLabel =
    companyLabel && activeWarehouseName
      ? msg("shell.workspaceWarehouseContext", {
          warehouse: activeWarehouseName,
          workspace: companyLabel,
        })
      : companyLabel
        ? msg("shell.workspaceChip", { label: companyLabel })
        : activeWarehouseName
          ? msg("shell.warehouseContextChip", { label: activeWarehouseName })
          : undefined;

  return (
    <ResourceTable
      columns={[
        {
          header: "Priority rank",
          key: "rank",
          render: (row) => String(row.fulfillment_rank ?? "--"),
        },
        {
          header: "Work order",
          key: "work-order",
          render: (row) => (
            <Stack spacing={0.35}>
              <Typography variant="body2">{row.display_code}</Typography>
              <Typography variant="subtitle2">{row.title}</Typography>
              <Typography color="text.secondary" variant="caption">
                {row.source_reference || "--"}
              </Typography>
            </Stack>
          ),
        },
        { header: "Type", key: "type", render: (row) => row.work_order_type_name },
        {
          header: "Workstream",
          key: "workstream",
          render: (row) => {
            const labelKey = getWorkOrderWorkstreamLabelKey(row.workstream);
            return labelKey ? translate(labelKey) : row.workstream;
          },
        },
        {
          header: "Urgency",
          key: "urgency",
          render: (row) => {
            const labelKey = getWorkOrderUrgencyLabelKey(row.urgency);
            return (
              <Chip
                color={urgencyChipColor(row.urgency)}
                label={labelKey ? translate(labelKey) : row.urgency}
                size="small"
              />
            );
          },
        },
        { header: "Priority score", key: "priority", render: (row) => String(row.priority_score) },
        {
          header: "Status",
          key: "status",
          render: (row) => {
            const labelKey = getWorkOrderStatusLabelKey(row.status);
            return labelKey ? translate(labelKey) : row.status;
          },
        },
        {
          header: "SLA",
          key: "sla",
          render: (row) => {
            const labelKey = getWorkOrderSlaStatusLabelKey(row.sla_status);
            return (
              <Chip
                color={slaChipColor(row.sla_status)}
                label={labelKey ? translate(labelKey) : row.sla_status}
                size="small"
              />
            );
          },
        },
        { header: "Due", key: "due", render: (row) => formatDateTime(row.due_at) },
        { header: "Assignee", key: "assignee", render: (row) => row.assignee_name || "--" },
        { header: "Client", key: "client", render: (row) => row.customer_account_name || "--" },
        {
          header: "Action",
          key: "action",
          render: (row) => (
            <Button onClick={() => onEdit(row)} size="small" variant="outlined">
              {t("Edit")}
            </Button>
          ),
        },
      ]}
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      pagination={{
        page: dataView.page,
        pageSize: dataView.pageSize,
        total,
        onPageChange: dataView.setPage,
      }}
      rows={workOrders}
      subtitle="Schedule and rank the actual execution queue so managers can see which orders should be fulfilled first."
      title="Work order manage"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          contextLabel={contextLabel}
          fields={workOrderFields}
          filters={dataView.filters}
          onChange={dataView.updateFilter}
          onReset={dataView.resetFilters}
          resultCount={total}
          savedViews={{
            items: dataView.savedViews,
            selectedId: dataView.selectedSavedViewId,
            onApply: dataView.applySavedView,
            onDelete: dataView.deleteSavedView,
            onSave: dataView.saveCurrentView,
          }}
        />
      }
    />
  );
}
