import type { PickTaskRecord, SalesOrderRecord, ShipmentRecord } from "@/shared/types/domain";
import type { z } from "zod";

import type { salesOrderEditSchema, scanPickSchema, scanShipSchema, shipmentCreateSchema } from "./validators";

export type { PickTaskRecord, SalesOrderRecord, ShipmentRecord };
export type SalesOrderEditValues = z.infer<typeof salesOrderEditSchema>;
export type ShipmentCreateValues = z.infer<typeof shipmentCreateSchema>;
export interface SalesOrderUpdatePayload {
  requested_ship_date: string | null;
  reference_code: string;
  notes: string;
}
export type ScanPickValues = z.infer<typeof scanPickSchema>;
export type ScanShipValues = z.infer<typeof scanShipSchema>;
