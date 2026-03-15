import type {
  InventoryBalanceRecord,
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type { transferOrderCreateSchema, transferOrderEditSchema } from "./validators";

export type {
  InventoryBalanceRecord,
  ReplenishmentRuleRecord,
  ReplenishmentTaskRecord,
  TransferLineRecord,
  TransferOrderRecord,
};

export type TransferOrderCreateValues = z.infer<typeof transferOrderCreateSchema>;
export type TransferOrderEditValues = z.infer<typeof transferOrderEditSchema>;

export interface TransferOrderCreatePayload {
  warehouse: number;
  transfer_number: string;
  requested_date: string | null;
  reference_code: string;
  notes: string;
  line_items: Array<{
    line_number: number;
    goods: number;
    from_location: number;
    to_location: number;
    requested_qty: number;
    stock_status: string;
    lot_number: string;
    serial_number: string;
    notes: string;
  }>;
}

export interface TransferOrderUpdatePayload {
  requested_date: string | null;
  reference_code: string;
  notes: string;
}
