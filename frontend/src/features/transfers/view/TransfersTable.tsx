import Grid from "@mui/material/Grid";
import { Button } from "@mui/material";

import type {
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderRecord,
} from "@/features/transfers/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

const transferOrderFields: DataViewFieldConfig<{ transfer_number__icontains: string; status: string }>[] = [
  { key: "transfer_number__icontains", label: "Transfer", placeholder: "TR-1001" },
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "In progress", value: "IN_PROGRESS" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
];

const transferLineFields: DataViewFieldConfig<{ status: string; assigned_to__isnull: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Open", value: "OPEN" },
      { label: "Completed", value: "COMPLETED" },
      { label: "Cancelled", value: "CANCELLED" },
    ],
  },
  {
    key: "assigned_to__isnull",
    label: "Assignment",
    type: "select",
    options: [
      { label: "Unassigned", value: "true" },
      { label: "Assigned", value: "false" },
    ],
  },
];

const replenishmentRuleFields: DataViewFieldConfig<{ stock_status: string; is_active: string }>[] = [
  {
    key: "stock_status",
    label: "Stock status",
    type: "select",
    options: [
      { label: "Available", value: "AVAILABLE" },
      { label: "Hold", value: "HOLD" },
      { label: "Damaged", value: "DAMAGED" },
    ],
  },
  {
    key: "is_active",
    label: "Rule state",
    type: "select",
    options: [
      { label: "Active", value: "true" },
      { label: "Inactive", value: "false" },
    ],
  },
];

const replenishmentTaskFields: DataViewFieldConfig<{ status: string; assigned_to__isnull: string }>[] = [
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
  {
    key: "assigned_to__isnull",
    label: "Assignment",
    type: "select",
    options: [
      { label: "Unassigned", value: "true" },
      { label: "Assigned", value: "false" },
    ],
  },
];

interface TransfersTableProps {
  activeWarehouseName?: string | null;
  transferOrdersQuery: PaginatedQueryState<TransferOrderRecord>;
  transferOrdersView: UseDataViewResult<{ transfer_number__icontains: string; status: string }>;
  transferLinesQuery: PaginatedQueryState<TransferLineRecord>;
  transferLinesView: UseDataViewResult<{ status: string; assigned_to__isnull: string }>;
  replenishmentRulesQuery: PaginatedQueryState<ReplenishmentRuleRecord>;
  replenishmentRulesView: UseDataViewResult<{ stock_status: string; is_active: string }>;
  replenishmentTasksQuery: PaginatedQueryState<ReplenishmentTaskRecord>;
  replenishmentTasksView: UseDataViewResult<{ status: string; assigned_to__isnull: string }>;
  isGeneratingTask: boolean;
  isCompletingTask: boolean;
  onGenerateTask: (replenishmentRuleId: number) => void;
  onCompleteTask: (replenishmentTaskId: number) => void;
}

export function TransfersTable({
  activeWarehouseName,
  transferOrdersQuery,
  transferOrdersView,
  transferLinesQuery,
  transferLinesView,
  replenishmentRulesQuery,
  replenishmentRulesView,
  replenishmentTasksQuery,
  replenishmentTasksView,
  isGeneratingTask,
  isCompletingTask,
  onGenerateTask,
  onCompleteTask,
}: TransfersTableProps) {
  return (
    <Grid container spacing={2.5}>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            {
              header: "Transfer",
              key: "transfer",
              render: (row) => (
                <RecordLink to={`/transfers/transfer-orders/${row.id}`}>
                  {row.transfer_number}
                </RecordLink>
              ),
            },
            { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
            { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_date) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          error={transferOrdersQuery.error ? parseApiError(transferOrdersQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={transferOrdersQuery.isLoading}
          pagination={{
            page: transferOrdersView.page,
            pageSize: transferOrdersView.pageSize,
            total: transferOrdersQuery.data?.count ?? 0,
            onPageChange: transferOrdersView.setPage,
          }}
          rows={transferOrdersQuery.data?.results ?? []}
          subtitle="Planned internal stock moves across warehouse locations"
          title="Transfer orders"
          toolbar={
            <DataViewToolbar
              activeFilterCount={transferOrdersView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={transferOrderFields}
              filters={transferOrdersView.filters}
              onChange={transferOrdersView.updateFilter}
              onReset={transferOrdersView.resetFilters}
              resultCount={transferOrdersQuery.data?.count}
              savedViews={{
                items: transferOrdersView.savedViews,
                selectedId: transferOrdersView.selectedSavedViewId,
                onApply: transferOrdersView.applySavedView,
                onDelete: transferOrdersView.deleteSavedView,
                onSave: transferOrdersView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "Line", key: "line", render: (row) => `${row.transfer_order}-${row.line_number}` },
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "From", key: "from", render: (row) => row.from_location_code },
            { header: "To", key: "to", render: (row) => row.to_location_code },
            { header: "Qty", key: "qty", align: "right", render: (row) => formatNumber(row.requested_qty) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
          ]}
          error={transferLinesQuery.error ? parseApiError(transferLinesQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={transferLinesQuery.isLoading}
          pagination={{
            page: transferLinesView.page,
            pageSize: transferLinesView.pageSize,
            total: transferLinesQuery.data?.count ?? 0,
            onPageChange: transferLinesView.setPage,
          }}
          rows={transferLinesQuery.data?.results ?? []}
          subtitle="Transfer execution lines derived from transfer orders"
          title="Transfer lines"
          toolbar={
            <DataViewToolbar
              activeFilterCount={transferLinesView.activeFilterCount}
              fields={transferLineFields}
              filters={transferLinesView.filters}
              onChange={transferLinesView.updateFilter}
              onReset={transferLinesView.resetFilters}
              resultCount={transferLinesQuery.data?.count}
              savedViews={{
                items: transferLinesView.savedViews,
                selectedId: transferLinesView.selectedSavedViewId,
                onApply: transferLinesView.applySavedView,
                onDelete: transferLinesView.deleteSavedView,
                onSave: transferLinesView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12, xl: 6 }}>
        <ResourceTable
          columns={[
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "Source", key: "source", render: (row) => row.source_location_code },
            { header: "Target", key: "target", render: (row) => row.target_location_code },
            { header: "Min", key: "min", align: "right", render: (row) => formatNumber(row.minimum_qty) },
            {
              header: "Target qty",
              key: "targetQty",
              align: "right",
              render: (row) => formatNumber(row.target_qty),
            },
            { header: "Priority", key: "priority", align: "right", render: (row) => row.priority },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isGeneratingTask || !row.is_active}
                  onClick={() => onGenerateTask(row.id)}
                  size="small"
                  variant="outlined"
                >
                  Generate task
                </Button>
              ),
            },
          ]}
          error={replenishmentRulesQuery.error ? parseApiError(replenishmentRulesQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={replenishmentRulesQuery.isLoading}
          pagination={{
            page: replenishmentRulesView.page,
            pageSize: replenishmentRulesView.pageSize,
            total: replenishmentRulesQuery.data?.count ?? 0,
            onPageChange: replenishmentRulesView.setPage,
          }}
          rows={replenishmentRulesQuery.data?.results ?? []}
          subtitle="Min-max replenishment rules for forward locations"
          title="Replenishment rules"
          toolbar={
            <DataViewToolbar
              activeFilterCount={replenishmentRulesView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={replenishmentRuleFields}
              filters={replenishmentRulesView.filters}
              onChange={replenishmentRulesView.updateFilter}
              onReset={replenishmentRulesView.resetFilters}
              resultCount={replenishmentRulesQuery.data?.count}
              savedViews={{
                items: replenishmentRulesView.savedViews,
                selectedId: replenishmentRulesView.selectedSavedViewId,
                onApply: replenishmentRulesView.applySavedView,
                onDelete: replenishmentRulesView.deleteSavedView,
                onSave: replenishmentRulesView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
      <Grid size={{ xs: 12 }}>
        <ResourceTable
          columns={[
            { header: "Task", key: "task", render: (row) => row.task_number },
            { header: "SKU", key: "sku", render: (row) => row.goods_code },
            { header: "From", key: "from", render: (row) => row.from_location_code },
            { header: "To", key: "to", render: (row) => row.to_location_code },
            { header: "Generated", key: "generated", render: (row) => formatDateTime(row.generated_at) },
            { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
            {
              header: "Action",
              key: "action",
              render: (row) => (
                <Button
                  disabled={isCompletingTask || row.status === "COMPLETED"}
                  onClick={() => onCompleteTask(row.id)}
                  size="small"
                  variant="contained"
                >
                  Complete
                </Button>
              ),
            },
          ]}
          error={replenishmentTasksQuery.error ? parseApiError(replenishmentTasksQuery.error) : null}
          getRowId={(row) => row.id}
          isLoading={replenishmentTasksQuery.isLoading}
          pagination={{
            page: replenishmentTasksView.page,
            pageSize: replenishmentTasksView.pageSize,
            total: replenishmentTasksQuery.data?.count ?? 0,
            onPageChange: replenishmentTasksView.setPage,
          }}
          rows={replenishmentTasksQuery.data?.results ?? []}
          subtitle="Generated replenishment work ready for completion"
          title="Replenishment tasks"
          toolbar={
            <DataViewToolbar
              activeFilterCount={replenishmentTasksView.activeFilterCount}
              contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : "All warehouses"}
              fields={replenishmentTaskFields}
              filters={replenishmentTasksView.filters}
              onChange={replenishmentTasksView.updateFilter}
              onReset={replenishmentTasksView.resetFilters}
              resultCount={replenishmentTasksQuery.data?.count}
              savedViews={{
                items: replenishmentTasksView.savedViews,
                selectedId: replenishmentTasksView.selectedSavedViewId,
                onApply: replenishmentTasksView.applySavedView,
                onDelete: replenishmentTasksView.deleteSavedView,
                onSave: replenishmentTasksView.saveCurrentView,
              }}
            />
          }
        />
      </Grid>
    </Grid>
  );
}
