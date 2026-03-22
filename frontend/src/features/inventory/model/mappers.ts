import type {
  CrossWarehouseTransferCandidate,
  InventoryAdjustmentValues,
  InventoryBalanceRecord,
  InventoryMovementRecord,
  StockAgeBucket,
  StockAgeRow,
} from "@/features/inventory/model/types";

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

function ageInDays(value: string | null | undefined) {
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
      age_days: ageInDays(balance.last_movement_at ?? balance.update_time),
      last_activity: balance.last_movement_at ?? balance.update_time,
    }))
    .sort((left, right) => right.age_days - left.age_days);
}

export function buildStockAgeBuckets(rows: StockAgeRow[]): StockAgeBucket[] {
  const buckets = [
    { label: "0-30 days", count: 0, quantity: 0, predicate: (age: number) => age <= 30 },
    { label: "31-60 days", count: 0, quantity: 0, predicate: (age: number) => age >= 31 && age <= 60 },
    { label: "61-90 days", count: 0, quantity: 0, predicate: (age: number) => age >= 61 && age <= 90 },
    { label: "90+ days", count: 0, quantity: 0, predicate: (age: number) => age >= 91 },
  ];

  rows.forEach((row) => {
    const bucket = buckets.find((candidate) => candidate.predicate(row.age_days));
    if (!bucket) {
      return;
    }
    bucket.count += 1;
    bucket.quantity += numeric(row.on_hand_qty);
  });

  return buckets.map(({ predicate: _predicate, ...bucket }) => bucket);
}

export function buildRecentAdjustments(
  adjustmentInRows: InventoryMovementRecord[],
  adjustmentOutRows: InventoryMovementRecord[],
) {
  return [...adjustmentInRows, ...adjustmentOutRows]
    .sort((left, right) => new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime())
    .slice(0, 12);
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
