import { describe, expect, it } from "vitest";

import {
  buildInterwarehouseTransferBucketCounts,
  buildInterwarehouseTransferCsv,
  buildInterwarehouseTransferRows,
  filterInterwarehouseTransferRowsByScope,
  filterInterwarehouseTransferRows,
  type InterwarehouseTransferOrderRecord,
} from "@/features/inventory/model/interwarehouse-transfer";
import type { LocationRecord, WarehouseRecord } from "@/shared/types/domain";

const warehouses: WarehouseRecord[] = [
  {
    id: 1,
    warehouse_name: "North DC",
    warehouse_city: "",
    warehouse_address: "",
    warehouse_contact: "",
    warehouse_manager: "",
    creator: "",
    create_time: "",
    update_time: "",
  },
  {
    id: 2,
    warehouse_name: "South DC",
    warehouse_city: "",
    warehouse_address: "",
    warehouse_contact: "",
    warehouse_manager: "",
    creator: "",
    create_time: "",
    update_time: "",
  },
];

const locations: LocationRecord[] = [
  {
    id: 10,
    warehouse: 1,
    warehouse_name: "North DC",
    zone: 1,
    zone_code: "A",
    location_type: 1,
    location_type_code: "RACK",
    location_code: "A-01",
    location_name: "A-01",
    aisle: "",
    bay: "",
    level: "",
    slot: "",
    barcode: "",
    capacity_qty: "0",
    max_weight: "0",
    max_volume: "0",
    pick_sequence: 1,
    is_pick_face: false,
    is_locked: false,
    status: "ACTIVE",
    creator: "",
    openid: "",
    create_time: "",
    update_time: "",
  },
  {
    id: 20,
    warehouse: 2,
    warehouse_name: "South DC",
    zone: 1,
    zone_code: "B",
    location_type: 1,
    location_type_code: "RACK",
    location_code: "B-01",
    location_name: "B-01",
    aisle: "",
    bay: "",
    level: "",
    slot: "",
    barcode: "",
    capacity_qty: "0",
    max_weight: "0",
    max_volume: "0",
    pick_sequence: 1,
    is_pick_face: false,
    is_locked: false,
    status: "ACTIVE",
    creator: "",
    openid: "",
    create_time: "",
    update_time: "",
  },
];

const orders: InterwarehouseTransferOrderRecord[] = [
  {
    id: 101,
    organization_id: 9,
    warehouse_id: 1,
    transfer_number: "TR-1001",
    requested_date: "2026-04-10",
    reference_code: "REF-1",
    status: "IN_PROGRESS",
    notes: "rush move",
    lines: [
      {
        id: 1,
        line_number: 1,
        product_id: 100,
        from_location_id: 10,
        to_location_id: 20,
        requested_qty: "5",
        moved_qty: "2",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        status: "COMPLETED",
        assigned_membership_id: null,
        completed_by: "",
        completed_at: "2026-04-11T12:00:00Z",
        inventory_movement_id: null,
        notes: "",
        create_time: "2026-04-10T08:00:00Z",
        update_time: "2026-04-11T12:00:00Z",
      },
    ],
    create_time: "2026-04-10T08:00:00Z",
    update_time: "2026-04-11T12:00:00Z",
  },
  {
    id: 102,
    organization_id: 9,
    warehouse_id: 1,
    transfer_number: "TR-1002",
    requested_date: "2026-04-12",
    reference_code: "",
    status: "COMPLETED",
    notes: "",
    lines: [
      {
        id: 2,
        line_number: 1,
        product_id: 200,
        from_location_id: 10,
        to_location_id: 10,
        requested_qty: "3",
        moved_qty: "3",
        stock_status: "AVAILABLE",
        lot_number: "",
        serial_number: "",
        status: "COMPLETED",
        assigned_membership_id: null,
        completed_by: "",
        completed_at: "2026-04-12T14:00:00Z",
        inventory_movement_id: null,
        notes: "",
        create_time: "2026-04-12T09:00:00Z",
        update_time: "2026-04-12T14:00:00Z",
      },
    ],
    create_time: "2026-04-12T09:00:00Z",
    update_time: "2026-04-12T14:00:00Z",
  },
];

describe("interwarehouse transfer model", () => {
  it("derives bucket counts and destination warehouses from locations", () => {
    const rows = buildInterwarehouseTransferRows(orders, warehouses, locations);
    const counts = buildInterwarehouseTransferBucketCounts(rows);

    expect(rows[0]?.toWarehouseName).toBe("South DC");
    expect(rows[0]?.transferType).toBe("CROSS_WAREHOUSE");
    expect(rows[0]?.bucket).toBe("pending_stock_in");
    expect(counts).toMatchObject({
      all: 2,
      pending_stock_in: 1,
      stocked_in: 1,
    });
  });

  it("filters and exports the visible queue", () => {
    const rows = buildInterwarehouseTransferRows(orders, warehouses, locations);
    const filteredRows = filterInterwarehouseTransferRows(
      rows,
      {
        fromWarehouseId: "1",
        toWarehouseId: "2",
        transferType: "CROSS_WAREHOUSE",
        searchField: "transfer_number",
        searchText: "TR-1001",
        searchMode: "contains",
        dateField: "create_time",
        dateFrom: "2026-04-10",
        dateTo: "2026-04-11",
      },
      "all",
    );

    const csv = buildInterwarehouseTransferCsv(filteredRows);

    expect(filteredRows).toHaveLength(1);
    expect(csv).toContain("TR-1001");
    expect(csv).toContain("South DC");
  });

  it("splits internal moves from inter-warehouse transfers", () => {
    const rows = buildInterwarehouseTransferRows(orders, warehouses, locations);

    expect(filterInterwarehouseTransferRowsByScope(rows, "internal").map((row) => row.transferNumber)).toEqual(["TR-1002"]);
    expect(filterInterwarehouseTransferRowsByScope(rows, "interWarehouse").map((row) => row.transferNumber)).toEqual([
      "TR-1001",
    ]);
  });
});
