import type { InventoryBalanceRecord } from "@/features/inventory/model/types";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface InventoryTableProps {
  balancesQuery: PaginatedQueryState<InventoryBalanceRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
}

export function InventoryTable({ balancesQuery, page, pageSize, setPage }: InventoryTableProps) {
  return (
    <ResourceTable
      columns={[
        { header: "SKU", key: "sku", render: (row) => row.goods_code },
        { header: "Location", key: "location", render: (row) => row.location_code },
        { header: "Warehouse", key: "warehouse", render: (row) => row.warehouse_name },
        { header: "Status", key: "status", render: (row) => <StatusChip status={row.stock_status} /> },
        { header: "On hand", key: "onHand", align: "right", render: (row) => formatNumber(row.on_hand_qty) },
        { header: "Allocated", key: "allocated", align: "right", render: (row) => formatNumber(row.allocated_qty) },
        { header: "Hold", key: "hold", align: "right", render: (row) => formatNumber(row.hold_qty) },
        { header: "Available", key: "available", align: "right", render: (row) => formatNumber(row.available_qty) },
        { header: "Last movement", key: "lastMovement", render: (row) => formatDateTime(row.last_movement_at) },
      ]}
      error={balancesQuery.error ? parseApiError(balancesQuery.error) : null}
      getRowId={(row) => row.id}
      isLoading={balancesQuery.isLoading}
      pagination={{
        page,
        pageSize,
        total: balancesQuery.data?.count ?? 0,
        onPageChange: setPage,
      }}
      rows={balancesQuery.data?.results ?? []}
      subtitle="Backed by `/api/inventory/balances/`"
      title="Inventory positions"
    />
  );
}
