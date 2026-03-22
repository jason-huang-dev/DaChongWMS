import type { InventoryBalanceRecord } from "@/features/inventory/model/types";
import { DataViewToolbar, type DataViewFieldConfig } from "@/shared/components/data-view-toolbar";
import { ResourceTable } from "@/shared/components/resource-table";
import { StatusChip } from "@/shared/components/status-chip";
import type { DataViewFilters } from "@/shared/hooks/use-data-view";
import type { SavedDataView } from "@/shared/storage/data-view-storage";
import type { PaginatedQueryState } from "@/shared/types/query";
import { formatDateTime, formatNumber } from "@/shared/utils/format";
import { parseApiError } from "@/shared/utils/parse-api-error";

interface InventoryFilters extends DataViewFilters {
  search: string;
  stock_status: string;
  lot_number__icontains: string;
  serial_number__icontains: string;
}

interface InventoryTableProps {
  balancesQuery: PaginatedQueryState<InventoryBalanceRecord>;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  filters: InventoryFilters;
  activeFilterCount: number;
  updateFilter: (key: keyof InventoryFilters & string, value: string) => void;
  resetFilters: () => void;
  savedViews: SavedDataView<InventoryFilters>[];
  selectedSavedViewId: string | null;
  applySavedView: (viewId: string) => void;
  saveCurrentView: (name: string) => void;
  deleteSavedView: (viewId: string) => void;
  contextLabel?: string;
}

const inventoryFilterFields: DataViewFieldConfig<InventoryFilters>[] = [
  {
    key: "search",
    label: "Search SKU or location",
    placeholder: "SKU-1001 or A-01-01",
  },
  {
    key: "stock_status",
    label: "Stock status",
    type: "select",
    options: [
      { label: "Available", value: "AVAILABLE" },
      { label: "Allocated", value: "ALLOCATED" },
      { label: "Held", value: "HOLD" },
      { label: "Damaged", value: "DAMAGED" },
      { label: "Quarantine", value: "QUARANTINE" },
    ],
  },
  {
    key: "lot_number__icontains",
    label: "Lot",
    placeholder: "LOT-2026",
  },
  {
    key: "serial_number__icontains",
    label: "Serial",
    placeholder: "Serial number",
  },
];

export function InventoryTable({
  balancesQuery,
  page,
  pageSize,
  setPage,
  filters,
  activeFilterCount,
  updateFilter,
  resetFilters,
  savedViews,
  selectedSavedViewId,
  applySavedView,
  saveCurrentView,
  deleteSavedView,
  contextLabel,
}: InventoryTableProps) {
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
      subtitle="Live inventory positions from the stock ledger."
      title="Inventory positions"
      toolbar={
        <DataViewToolbar
          activeFilterCount={activeFilterCount}
          contextLabel={contextLabel}
          fields={inventoryFilterFields}
          filters={filters}
          onChange={updateFilter}
          onReset={resetFilters}
          resultCount={balancesQuery.data?.count}
          savedViews={{
            items: savedViews,
            selectedId: selectedSavedViewId,
            onApply: applySavedView,
            onDelete: deleteSavedView,
            onSave: saveCurrentView,
          }}
        />
      }
    />
  );
}
