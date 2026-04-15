import { describe, expect, it } from "vitest";

import { mapCreateValuesToTransferOrderPayload } from "@/features/transfers/model/mappers";
import type { InventoryBalanceRecord } from "@/features/transfers/model/types";

describe("transfer mappers", () => {
  it("maps transfer create values to the first-class transfer payload", () => {
    const balancesById = new Map<number, InventoryBalanceRecord>([
      [
        15,
        {
          id: 15,
          warehouse: 4,
          warehouse_name: "North DC",
          location: 99,
          location_code: "A-01",
          goods: 77,
          goods_code: "SKU-77",
          stock_status: "AVAILABLE",
          lot_number: "LOT-1",
          serial_number: "",
          on_hand_qty: "10",
          allocated_qty: "0",
          hold_qty: "0",
          available_qty: "10",
          unit_cost: "1.00",
          currency: "USD",
          creator: "",
          last_movement_at: null,
          create_time: "",
          update_time: "",
        },
      ],
    ]);

    const payload = mapCreateValuesToTransferOrderPayload(
      {
        warehouse: 4,
        transfer_number: "TR-2001",
        requested_date: "2026-04-15",
        reference_code: "REF-77",
        notes: "priority",
        line_items: [
          {
            source_balance: 15,
            to_location: 108,
            requested_qty: 3,
          },
        ],
      },
      balancesById,
    );

    expect(payload).toEqual({
      warehouse_id: 4,
      transfer_number: "TR-2001",
      requested_date: "2026-04-15",
      reference_code: "REF-77",
      notes: "priority",
      line_items: [
        {
          line_number: 1,
          product_id: 77,
          from_location_id: 99,
          to_location_id: 108,
          requested_qty: 3,
          stock_status: "AVAILABLE",
          lot_number: "LOT-1",
          serial_number: "",
          notes: "",
        },
      ],
    });
  });
});
