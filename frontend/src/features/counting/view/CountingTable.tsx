import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { RecordLink } from "@/shared/components/record-link";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { UseDataViewResult } from "@/shared/hooks/use-data-view";
import type { CountApprovalQueueRecord } from "@/features/counting/model/types";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

const approvalFields: DataViewFieldConfig<{ status: string; requested_by__icontains: string }>[] = [
  {
    key: "status",
    label: "Status",
    type: "select",
    options: [
      { label: "Pending", value: "PENDING" },
      { label: "Rejected", value: "REJECTED" },
      { label: "Approved", value: "APPROVED" },
    ],
  },
  {
    key: "requested_by__icontains",
    label: "Requested by",
    placeholder: "Supervisor or counter",
    width: 220,
  },
];

interface CountingTableProps {
  rows: CountApprovalQueueRecord[];
  isLoading: boolean;
  error?: string | null;
  total: number;
  activeWarehouseName?: string | null;
  dataView: UseDataViewResult<{ status: string; requested_by__icontains: string }>;
}

export function CountingTable({
  rows,
  isLoading,
  error,
  total,
  activeWarehouseName,
  dataView,
}: CountingTableProps) {
  return (
    <ResourceTable
      columns={[
        {
          header: "Count",
          key: "count",
          render: (row) => <RecordLink to={`/counting/approvals/${row.id}`}>{row.count_number}</RecordLink>,
        },
        { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
        { header: "Location", key: "location", render: (row) => row.location_code },
        { header: "SKU", key: "sku", render: (row) => row.goods_code },
        { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
        { header: "Requested by", key: "requestedBy", render: (row) => row.requested_by },
        { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_at) },
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
      rows={rows}
      subtitle="Approval queue used by supervisors and stock control"
      title="Variance approvals"
      toolbar={
        <DataViewToolbar
          activeFilterCount={dataView.activeFilterCount}
          contextLabel={activeWarehouseName ? `Warehouse: ${activeWarehouseName}` : undefined}
          fields={approvalFields}
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
