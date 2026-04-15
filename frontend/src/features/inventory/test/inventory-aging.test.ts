import { describe, expect, test, vi } from "vitest";

import {
  buildStockAgeBuckets,
  buildStockAgeRows,
  compareStockAgeBucketLabels,
  resolveStockAgeBucketLabel,
  sumStockAgeQuantity,
} from "@/features/inventory/model/mappers";
import type { InventoryBalanceRecord } from "@/shared/types/domain";

describe("inventory aging helpers", () => {
  test("buildStockAgeBuckets counts unique SKUs and sums on-hand quantity by age band", () => {
    const buckets = buildStockAgeBuckets([
      { age_days: 12, goods_code: "SKU-001", on_hand_qty: "5" },
      { age_days: 15, goods_code: "SKU-001", on_hand_qty: "4" },
      { age_days: 44, goods_code: "SKU-002", on_hand_qty: "9" },
      { age_days: 78, goods_code: "SKU-003", on_hand_qty: "11" },
      { age_days: 126, goods_code: "SKU-004", on_hand_qty: "7" },
    ]);

    expect(buckets).toEqual([
      { label: "<30", count: 1, quantity: 9 },
      { label: "31-60", count: 1, quantity: 9 },
      { label: "61-90", count: 1, quantity: 11 },
      { label: "90+", count: 1, quantity: 7 },
    ]);
  });

  test("buildStockAgeRows calculates age from the storage date and keeps storage/update fields", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-14T12:00:00Z"));

    const balances: InventoryBalanceRecord[] = [
      {
        id: 1,
        warehouse: 1,
        warehouse_name: "Main WH",
        location: 10,
        location_code: "A-01-01",
        goods: 100,
        goods_code: "SKU-001",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        on_hand_qty: "12",
        allocated_qty: "0",
        hold_qty: "0",
        available_qty: "12",
        unit_cost: "1.00",
        currency: "USD",
        creator: "tester",
        last_movement_at: "2026-04-10T12:00:00Z",
        create_time: "2026-04-01T00:00:00Z",
        update_time: "2026-04-12T12:00:00Z",
      },
    ];

    expect(buildStockAgeRows(balances)).toEqual([
      {
        id: 1,
        goods_code: "SKU-001",
        location_code: "A-01-01",
        warehouse_name: "Main WH",
        on_hand_qty: "12",
        available_qty: "12",
        age_days: 13,
        storage_date: "2026-04-01T00:00:00Z",
        last_activity: "2026-04-10T12:00:00Z",
        update_time: "2026-04-12T12:00:00Z",
      },
    ]);

    vi.useRealTimers();
  });

  test("stock age helper utilities keep bucket ordering and quantity totals consistent", () => {
    expect(resolveStockAgeBucketLabel(5)).toBe("<30");
    expect(resolveStockAgeBucketLabel(45)).toBe("31-60");
    expect(resolveStockAgeBucketLabel(75)).toBe("61-90");
    expect(resolveStockAgeBucketLabel(120)).toBe("90+");
    expect(compareStockAgeBucketLabels("<30", "90+")).toBeLessThan(0);
    expect(sumStockAgeQuantity([{ on_hand_qty: "5" }, { on_hand_qty: "3" }, { on_hand_qty: "bad" }])).toBe(8);
  });
});
