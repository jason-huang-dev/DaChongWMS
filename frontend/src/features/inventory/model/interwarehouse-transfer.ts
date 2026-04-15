import { escapeCsvValue } from "@/shared/utils/csv";
import { formatNumber, formatStatusLabel } from "@/shared/utils/format";
import type { LocationRecord, WarehouseRecord } from "@/shared/types/domain";

export type InterwarehouseTransferBucket =
  | "all"
  | "pending"
  | "pending_stock_in"
  | "stocking_in"
  | "stocked_in"
  | "cancelled";

export interface InterwarehouseTransferLineRecord {
  id: number;
  line_number: number;
  product_id: number;
  from_location_id: number;
  to_location_id: number | null;
  requested_qty: string;
  moved_qty: string;
  stock_status: string;
  lot_number: string;
  serial_number: string;
  status: string;
  assigned_membership_id: number | null;
  completed_by: string;
  completed_at: string | null;
  inventory_movement_id: number | null;
  notes: string;
  create_time: string;
  update_time: string;
}

export interface InterwarehouseTransferOrderRecord {
  id: number;
  organization_id: number;
  warehouse_id: number;
  transfer_number: string;
  requested_date: string | null;
  reference_code: string;
  status: string;
  notes: string;
  lines: InterwarehouseTransferLineRecord[];
  create_time: string;
  update_time: string;
}

export interface InterwarehouseTransferFilters {
  [key: string]: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  transferType: string;
  searchField: "transfer_number" | "reference_code" | "notes" | "details";
  searchText: string;
  searchMode: "contains" | "exact";
  dateField: "create_time" | "requested_date";
  dateFrom: string;
  dateTo: string;
}

export interface InterwarehouseTransferRow {
  id: number;
  bucket: InterwarehouseTransferBucket;
  createTime: string;
  requestedDate: string | null;
  cancelTime: string | null;
  fromWarehouseId: number;
  fromWarehouseName: string;
  toWarehouseIds: number[];
  toWarehouseName: string;
  transferDetails: string;
  transferNumber: string;
  transferType: "CROSS_WAREHOUSE" | "INTERNAL_RELOCATION" | "MIXED";
  raw: InterwarehouseTransferOrderRecord;
  status: string;
  stockInTime: string | null;
  stockOutTime: string | null;
}

export type InventoryTransferWorkbenchScope = "internal" | "interWarehouse";

export const interwarehouseTransferBucketItems = [
  { label: "All", value: "all" },
  { label: "Pending", value: "pending" },
  { label: "Pending Stock-in", value: "pending_stock_in" },
  { label: "Stocking in", value: "stocking_in" },
  { label: "Stocked In", value: "stocked_in" },
  { label: "Cancelled", value: "cancelled" },
] as const satisfies Array<{ label: string; value: InterwarehouseTransferBucket }>;

export function createDefaultInterwarehouseTransferFilters(
  activeWarehouseId?: number | null,
): InterwarehouseTransferFilters {
  return {
    fromWarehouseId: activeWarehouseId ? String(activeWarehouseId) : "",
    toWarehouseId: "",
    transferType: "",
    searchField: "transfer_number",
    searchText: "",
    searchMode: "contains",
    dateField: "create_time",
    dateFrom: "",
    dateTo: "",
  };
}

function toComparableTimestamp(value?: string | null) {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? Number.NEGATIVE_INFINITY : parsed;
}

function resolveWarehouseLabel(warehouseId: number, warehousesById: Map<number, WarehouseRecord>) {
  return warehousesById.get(warehouseId)?.warehouse_name ?? `Warehouse #${warehouseId}`;
}

function buildToWarehouseIds(
  lines: InterwarehouseTransferLineRecord[],
  locationWarehouseIds: Map<number, number>,
) {
  return [...new Set(
    lines
      .map((line) => (line.to_location_id ? locationWarehouseIds.get(line.to_location_id) ?? null : null))
      .filter((warehouseId): warehouseId is number => typeof warehouseId === "number"),
  )];
}

function buildToWarehouseLabel(toWarehouseIds: number[], warehousesById: Map<number, WarehouseRecord>) {
  if (toWarehouseIds.length === 0) {
    return "--";
  }
  if (toWarehouseIds.length === 1) {
    return resolveWarehouseLabel(toWarehouseIds[0], warehousesById);
  }

  const [firstWarehouseId, ...otherWarehouseIds] = toWarehouseIds;
  return `${resolveWarehouseLabel(firstWarehouseId, warehousesById)} +${otherWarehouseIds.length}`;
}

function buildTransferType(fromWarehouseId: number, toWarehouseIds: number[]) {
  if (toWarehouseIds.length === 0) {
    return "INTERNAL_RELOCATION" as const;
  }
  if (toWarehouseIds.some((warehouseId) => warehouseId !== fromWarehouseId)) {
    return toWarehouseIds.length > 1 ? ("MIXED" as const) : ("CROSS_WAREHOUSE" as const);
  }
  return "INTERNAL_RELOCATION" as const;
}

function buildBucket(
  status: string,
  transferType: InterwarehouseTransferRow["transferType"],
): InterwarehouseTransferBucket {
  switch (status) {
    case "CANCELLED":
      return "cancelled";
    case "COMPLETED":
      return "stocked_in";
    case "IN_PROGRESS":
      return transferType === "CROSS_WAREHOUSE" || transferType === "MIXED"
        ? "pending_stock_in"
        : "stocking_in";
    case "OPEN":
    default:
      return "pending";
  }
}

function buildTransferDetails(lines: InterwarehouseTransferLineRecord[]) {
  if (lines.length === 0) {
    return "No lines";
  }

  const requestedQty = lines.reduce((total, line) => total + Number(line.requested_qty || 0), 0);
  const movedQty = lines.reduce((total, line) => total + Number(line.moved_qty || 0), 0);

  if (movedQty > 0) {
    return `${lines.length} lines · ${formatNumber(movedQty)} moved`;
  }

  return `${lines.length} lines · ${formatNumber(requestedQty)} requested`;
}

function resolveLineEventTime(
  lines: InterwarehouseTransferLineRecord[],
  direction: "earliest" | "latest",
) {
  const completedTimes = lines
    .map((line) => (line.completed_at ? new Date(line.completed_at).getTime() : Number.NaN))
    .filter((value) => !Number.isNaN(value));

  if (completedTimes.length === 0) {
    return null;
  }

  const timestamp =
    direction === "earliest"
      ? Math.min(...completedTimes)
      : Math.max(...completedTimes);

  return new Date(timestamp).toISOString();
}

export function buildInterwarehouseTransferRows(
  orders: InterwarehouseTransferOrderRecord[],
  warehouses: WarehouseRecord[],
  locations: LocationRecord[],
): InterwarehouseTransferRow[] {
  const warehousesById = new Map(warehouses.map((warehouse) => [warehouse.id, warehouse]));
  const locationWarehouseIds = new Map(locations.map((location) => [location.id, location.warehouse]));

  return orders.map((order) => {
    const toWarehouseIds = buildToWarehouseIds(order.lines, locationWarehouseIds);
    const transferType = buildTransferType(order.warehouse_id, toWarehouseIds);
    const bucket = buildBucket(order.status, transferType);
    const stockOutTime = resolveLineEventTime(order.lines, "earliest");
    const stockInTime =
      order.status === "COMPLETED" ? resolveLineEventTime(order.lines, "latest") : null;

    return {
      id: order.id,
      bucket,
      createTime: order.create_time,
      requestedDate: order.requested_date,
      cancelTime: order.status === "CANCELLED" ? order.update_time : null,
      fromWarehouseId: order.warehouse_id,
      fromWarehouseName: resolveWarehouseLabel(order.warehouse_id, warehousesById),
      toWarehouseIds,
      toWarehouseName: buildToWarehouseLabel(toWarehouseIds, warehousesById),
      transferDetails: buildTransferDetails(order.lines),
      transferNumber: order.transfer_number,
      transferType,
      raw: order,
      status: order.status,
      stockInTime,
      stockOutTime,
    };
  });
}

export function filterInterwarehouseTransferRowsByScope(
  rows: InterwarehouseTransferRow[],
  scope: InventoryTransferWorkbenchScope,
) {
  return rows.filter((row) =>
    scope === "internal"
      ? row.transferType === "INTERNAL_RELOCATION"
      : row.transferType === "CROSS_WAREHOUSE" || row.transferType === "MIXED",
  );
}

function resolveSearchValue(row: InterwarehouseTransferRow, field: InterwarehouseTransferFilters["searchField"]) {
  switch (field) {
    case "reference_code":
      return row.raw.reference_code;
    case "notes":
      return row.raw.notes;
    case "details":
      return row.transferDetails;
    case "transfer_number":
    default:
      return row.transferNumber;
  }
}

function matchesSearch(
  row: InterwarehouseTransferRow,
  field: InterwarehouseTransferFilters["searchField"],
  searchText: string,
  mode: InterwarehouseTransferFilters["searchMode"],
) {
  const candidate = resolveSearchValue(row, field).trim().toLowerCase();
  const normalizedSearch = searchText.trim().toLowerCase();
  if (!normalizedSearch) {
    return true;
  }

  return mode === "exact" ? candidate === normalizedSearch : candidate.includes(normalizedSearch);
}

function matchesDateRange(
  row: InterwarehouseTransferRow,
  field: InterwarehouseTransferFilters["dateField"],
  startDate: string,
  endDate: string,
) {
  if (!startDate && !endDate) {
    return true;
  }

  const sourceValue = field === "requested_date" ? row.requestedDate : row.createTime;
  if (!sourceValue) {
    return false;
  }

  const normalizedDate = sourceValue.slice(0, 10);
  if (startDate && normalizedDate < startDate) {
    return false;
  }
  if (endDate && normalizedDate > endDate) {
    return false;
  }
  return true;
}

export function filterInterwarehouseTransferRows(
  rows: InterwarehouseTransferRow[],
  filters: InterwarehouseTransferFilters,
  activeBucket: InterwarehouseTransferBucket,
) {
  return rows.filter((row) => {
    if (activeBucket !== "all" && row.bucket !== activeBucket) {
      return false;
    }
    if (filters.fromWarehouseId && row.fromWarehouseId !== Number(filters.fromWarehouseId)) {
      return false;
    }
    if (
      filters.toWarehouseId &&
      !row.toWarehouseIds.includes(Number(filters.toWarehouseId))
    ) {
      return false;
    }
    if (filters.transferType && row.transferType !== filters.transferType) {
      return false;
    }
    if (!matchesSearch(row, filters.searchField, filters.searchText, filters.searchMode)) {
      return false;
    }
    if (!matchesDateRange(row, filters.dateField, filters.dateFrom, filters.dateTo)) {
      return false;
    }
    return true;
  });
}

export function sortInterwarehouseTransferRows(
  rows: InterwarehouseTransferRow[],
  sortKey: "createTime" | "stockOutTime" | "stockInTime" | "cancelTime",
  direction: "asc" | "desc",
) {
  const multiplier = direction === "asc" ? 1 : -1;

  return [...rows].sort((left, right) => {
    const leftValue = toComparableTimestamp(left[sortKey]);
    const rightValue = toComparableTimestamp(right[sortKey]);
    if (leftValue === rightValue) {
      return left.transferNumber.localeCompare(right.transferNumber) * multiplier;
    }
    return (leftValue - rightValue) * multiplier;
  });
}

export function buildInterwarehouseTransferBucketCounts(rows: InterwarehouseTransferRow[]) {
  const counts: Record<InterwarehouseTransferBucket, number> = {
    all: rows.length,
    pending: 0,
    pending_stock_in: 0,
    stocking_in: 0,
    stocked_in: 0,
    cancelled: 0,
  };

  for (const row of rows) {
    counts[row.bucket] += 1;
  }

  return counts;
}

export function formatTransferTypeLabel(type: InterwarehouseTransferRow["transferType"]) {
  switch (type) {
    case "CROSS_WAREHOUSE":
      return "Cross warehouse";
    case "MIXED":
      return "Mixed destinations";
    case "INTERNAL_RELOCATION":
    default:
      return "Internal relocation";
  }
}

export function buildInterwarehouseTransferCsv(rows: InterwarehouseTransferRow[]) {
  const header = [
    "Transfer No.",
    "Status",
    "From Warehouse",
    "To Warehouse",
    "Transfer Type",
    "Transfer Details",
    "Note",
    "Appendix",
    "Creator",
    "Create Time",
    "Stock-Out Time",
    "Stock In Time",
    "Cancel Time",
  ];

  const records = rows.map((row) => [
    row.transferNumber,
    formatStatusLabel(row.status),
    row.fromWarehouseName,
    row.toWarehouseName,
    formatTransferTypeLabel(row.transferType),
    row.transferDetails,
    row.raw.notes || "",
    row.raw.reference_code || "",
    "--",
    row.createTime || "",
    row.stockOutTime || "",
    row.stockInTime || "",
    row.cancelTime || "",
  ]);

  return [header, ...records]
    .map((record) => record.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
}
