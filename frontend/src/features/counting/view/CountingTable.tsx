import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { CountApprovalQueueRecord } from "@/features/counting/model/types";
import { formatDateTime, formatNumber } from "@/shared/utils/format";

interface CountingTableProps {
  rows: CountApprovalQueueRecord[];
  isLoading: boolean;
  error?: string | null;
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function CountingTable({
  rows,
  isLoading,
  error,
  page,
  pageSize,
  total,
  onPageChange,
}: CountingTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "Count", key: "count", render: (row) => row.count_number },
        { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
        { header: "Location", key: "location", render: (row) => row.location_code },
        { header: "SKU", key: "sku", render: (row) => row.goods_code },
        { header: "Variance", key: "variance", align: "right", render: (row) => formatNumber(row.variance_qty) },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.status} /> },
        { header: "Requested", key: "requested", render: (row) => formatDateTime(row.requested_at) },
      ]}
      error={error}
      getRowId={(row) => row.id}
      isLoading={isLoading}
      pagination={{
        page,
        pageSize,
        total,
        onPageChange,
      }}
      rows={rows}
      subtitle="Approval queue used by supervisors and stock control"
      title="Variance approvals"
    />
  );
}
