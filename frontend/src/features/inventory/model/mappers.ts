import type {
  CrossWarehouseTransferCandidate,
  InventoryAdjustmentGroupItem,
  InventoryAdjustmentGroupRow,
  InventoryAdjustmentValues,
  InventoryBalanceRecord,
  InventoryMovementHistoryRow,
  InventoryMovementRecord,
  StockAgeBucket,
  StockAgeBucketLabel,
  StockAgeRow,
} from "@/features/inventory/model/types";
import { downloadCsvFile, escapeCsvValue } from "@/shared/utils/csv";

export const defaultInventoryAdjustmentValues: InventoryAdjustmentValues = {
  balance_id: 0,
  movement_type: "ADJUSTMENT_OUT",
  quantity: 0,
  reason: "",
  reference_code: "",
};

function numeric(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const stockAgeBucketLabels = ["<30", "31-60", "61-90", "90+"] as const satisfies readonly StockAgeBucketLabel[];

const stockAgeBucketOrder = new Map<StockAgeBucketLabel, number>(
  stockAgeBucketLabels.map((label, index) => [label, index]),
);

export function calculateStockAgeDays(value: string | null | undefined) {
  if (!value) {
    return 0;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return 0;
  }
  const ageMs = Date.now() - parsed.getTime();
  return Math.max(Math.floor(ageMs / (1000 * 60 * 60 * 24)), 0);
}

export function resolveStockAgeBucketLabel(ageDays: number): StockAgeBucketLabel {
  if (ageDays <= 30) {
    return "<30";
  }
  if (ageDays <= 60) {
    return "31-60";
  }
  if (ageDays <= 90) {
    return "61-90";
  }
  return "90+";
}

export function compareStockAgeBucketLabels(left: StockAgeBucketLabel, right: StockAgeBucketLabel) {
  return (stockAgeBucketOrder.get(left) ?? 0) - (stockAgeBucketOrder.get(right) ?? 0);
}

export function sumStockAgeQuantity<T extends Pick<StockAgeRow, "on_hand_qty">>(rows: T[]) {
  return rows.reduce((total, row) => total + numeric(row.on_hand_qty), 0);
}

export function sumVisibleQuantity(
  balances: InventoryBalanceRecord[],
  field: "on_hand_qty" | "allocated_qty" | "hold_qty" | "available_qty",
) {
  return balances.reduce((total, balance) => total + numeric(balance[field]), 0);
}

export function buildStockAgeRows(balances: InventoryBalanceRecord[]): StockAgeRow[] {
  return balances
    .map((balance) => ({
      id: balance.id,
      goods_code: balance.goods_code,
      location_code: balance.location_code,
      warehouse_name: balance.warehouse_name,
      on_hand_qty: balance.on_hand_qty,
      available_qty: balance.available_qty,
      age_days: calculateStockAgeDays(balance.create_time),
      storage_date: balance.create_time ?? null,
      last_activity: balance.last_movement_at ?? balance.update_time,
      update_time: balance.update_time ?? null,
    }))
    .sort((left, right) => right.age_days - left.age_days);
}

export function buildStockAgeBuckets<T extends Pick<StockAgeRow, "age_days" | "goods_code" | "on_hand_qty">>(
  rows: T[],
): StockAgeBucket[] {
  const buckets = new Map<StockAgeBucketLabel, { quantity: number; skus: Set<string> }>(
    stockAgeBucketLabels.map((label) => [label, { quantity: 0, skus: new Set<string>() }]),
  );

  rows.forEach((row) => {
    const bucket = buckets.get(resolveStockAgeBucketLabel(row.age_days));
    bucket?.skus.add(row.goods_code);
    if (bucket) {
      bucket.quantity += numeric(row.on_hand_qty);
    }
  });

  return stockAgeBucketLabels.map((label) => ({
    label,
    count: buckets.get(label)?.skus.size ?? 0,
    quantity: buckets.get(label)?.quantity ?? 0,
  }));
}

function buildCsvLine(values: Array<string | number | boolean | null | undefined>) {
  return values
    .map((value) => escapeCsvValue(value))
    .join(",");
}

export function buildStockAgeCsvContent(rows: Array<{
  merchantCode: string;
  merchantSku: string;
  productBarcode: string;
  productName: string;
  sizeLabel: string;
  warehouseName: string;
  clientLabel: string;
  location_code: string;
  storageDate: string | null;
  on_hand_qty: string;
  available_qty: string;
  age_days: number;
  updateTime: string | null;
}>) {
  const header = [
    "Merchant Code",
    "Merchant SKU",
    "Barcode",
    "Product Name",
    "Product Size",
    "Warehouse",
    "Client",
    "Location",
    "Storage Date",
    "Qty",
    "Available",
    "Stock Age (Day)",
    "Update Time",
  ];

  return [
    buildCsvLine(header),
    ...rows.map((row) =>
      buildCsvLine([
        row.merchantCode,
        row.merchantSku,
        row.productBarcode,
        row.productName,
        row.sizeLabel,
        row.warehouseName,
        row.clientLabel,
        row.location_code,
        row.storageDate ?? "",
        row.on_hand_qty,
        row.available_qty,
        row.age_days,
        row.updateTime ?? "",
      ]),
    ),
  ].join("\n");
}

export function downloadStockAgeRowsCsv(
  rows: Parameters<typeof buildStockAgeCsvContent>[0],
  filenamePrefix: string,
) {
  if (rows.length === 0) {
    return;
  }

  downloadCsvFile(buildStockAgeCsvContent(rows), `${filenamePrefix}.csv`);
}

function buildInventoryAdjustmentGroupCsvLine(group: InventoryAdjustmentGroupRow, item: InventoryAdjustmentGroupItem) {
  return buildCsvLine([
    group.adjustmentNumber,
    group.warehouseName,
    group.note,
    item.goodsCode,
    item.productName,
    item.lotNumber,
    item.serialNumber,
    item.adjustmentTypeLabel,
    item.shelfCode,
    item.signedQuantity,
    item.performedBy,
    item.occurredAt,
  ]);
}

export function buildInventoryAdjustmentCsvContent(groups: InventoryAdjustmentGroupRow[]) {
  const header = [
    "Adjustment No.",
    "Warehouse",
    "Note",
    "SKU",
    "Product Name",
    "Lot Number",
    "Serial Number",
    "Adjustment Type",
    "Shelf",
    "Adjustment Qty",
    "Operator",
    "Time",
  ];

  const lines = groups.flatMap((group) => group.items.map((item) => buildInventoryAdjustmentGroupCsvLine(group, item)));

  return [buildCsvLine(header), ...lines].join("\n");
}

export function downloadInventoryAdjustmentGroupsCsv(groups: InventoryAdjustmentGroupRow[], filenamePrefix: string) {
  if (groups.length === 0) {
    return;
  }

  downloadCsvFile(buildInventoryAdjustmentCsvContent(groups), `${filenamePrefix}.csv`);
}

export function buildRecentAdjustments(
  adjustmentInRows: InventoryMovementRecord[],
  adjustmentOutRows: InventoryMovementRecord[],
) {
  return [...adjustmentInRows, ...adjustmentOutRows]
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())
    .slice(0, 12);
}

function resolveInventoryAdjustmentTypeLabel(row: InventoryMovementHistoryRow) {
  if (row.entryTypeLabel?.trim()) {
    return row.entryTypeLabel.trim();
  }

  if (row.movementTypeLabel?.trim()) {
    return row.movementTypeLabel.trim();
  }

  return row.movementType === "ADJUSTMENT_IN"
    ? "Adjustment In"
    : row.movementType === "ADJUSTMENT_OUT"
      ? "Adjustment Out"
      : row.movementType;
}

function resolveInventoryAdjustmentGroupId(row: InventoryMovementHistoryRow) {
  const adjustmentNumber = row.referenceCode?.trim();
  if (adjustmentNumber) {
    return `${row.warehouseName || "warehouse"}:${adjustmentNumber}`;
  }

  return `movement:${row.id}`;
}

function buildInventoryAdjustmentGroupItem(row: InventoryMovementHistoryRow): InventoryAdjustmentGroupItem {
  const rawQuantity = Number(row.quantity) || 0;
  const signedQuantity = row.movementType === "ADJUSTMENT_OUT" ? -Math.abs(rawQuantity) : Math.abs(rawQuantity);

  return {
    id: row.id,
    goodsCode: row.merchantSku || row.productBarcode || "--",
    productName: row.productName || row.productBarcode || "",
    lotNumber: row.batchNumber || "",
    serialNumber: row.serialNumber || "",
    adjustmentTypeLabel: resolveInventoryAdjustmentTypeLabel(row),
    shelfCode: row.shelfCode || row.toLocationCode || row.fromLocationCode || "--",
    quantity: rawQuantity,
    signedQuantity,
    performedBy: row.performedBy || "--",
    occurredAt: row.occurredAt,
  };
}

export function buildInventoryAdjustmentGroups(rows: InventoryMovementHistoryRow[]): InventoryAdjustmentGroupRow[] {
  const groups = new Map<string, InventoryAdjustmentGroupRow>();

  rows.forEach((row) => {
    const groupId = resolveInventoryAdjustmentGroupId(row);
    const currentGroup = groups.get(groupId);
    const nextItem = buildInventoryAdjustmentGroupItem(row);
    const adjustmentNumber = row.referenceCode?.trim() || `ADJ-${row.id}`;
    const note = row.reason?.trim() || "--";

    if (!currentGroup) {
      groups.set(groupId, {
        id: groupId,
        adjustmentNumber,
        warehouseName: row.warehouseName || "--",
        note,
        latestOccurredAt: row.occurredAt,
        items: [nextItem],
      });
      return;
    }

    currentGroup.items.push(nextItem);
    if (new Date(row.occurredAt).getTime() > new Date(currentGroup.latestOccurredAt).getTime()) {
      currentGroup.latestOccurredAt = row.occurredAt;
    }
    if ((currentGroup.note === "--" || !currentGroup.note.trim()) && note !== "--") {
      currentGroup.note = note;
    }
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      items: [...group.items].sort(
        (left, right) => new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
      ),
    }))
    .sort((left, right) => new Date(right.latestOccurredAt).getTime() - new Date(left.latestOccurredAt).getTime());
}

export function buildCrossWarehouseTransferCandidates(
  balances: InventoryBalanceRecord[],
  activeWarehouseId: number | null,
): CrossWarehouseTransferCandidate[] {
  if (!activeWarehouseId) {
    return [];
  }

  const grouped = new Map<
    string,
    {
      activeWarehouseQty: number;
      otherWarehouseQty: number;
      otherWarehouses: Set<string>;
    }
  >();

  balances.forEach((balance) => {
    const current = grouped.get(balance.goods_code) ?? {
      activeWarehouseQty: 0,
      otherWarehouseQty: 0,
      otherWarehouses: new Set<string>(),
    };

    if (balance.warehouse === activeWarehouseId) {
      current.activeWarehouseQty += numeric(balance.available_qty);
    } else {
      current.otherWarehouseQty += numeric(balance.available_qty);
      current.otherWarehouses.add(balance.warehouse_name);
    }

    grouped.set(balance.goods_code, current);
  });

  return Array.from(grouped.entries())
    .map(([goodsCode, value]) => ({
      goods_code: goodsCode,
      active_warehouse_qty: value.activeWarehouseQty,
      other_warehouse_qty: value.otherWarehouseQty,
      other_warehouses: Array.from(value.otherWarehouses).sort(),
    }))
    .filter((row) => row.other_warehouse_qty > 0)
    .sort((left, right) => right.other_warehouse_qty - left.other_warehouse_qty)
    .slice(0, 12);
}
