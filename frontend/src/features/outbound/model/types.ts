import type {
  DockLoadVerificationRecord,
  LogisticsTrackingEventRecord,
  OutboundWaveRecord,
  PackageExecutionRecord,
  PickTaskRecord,
  SalesOrderRecord,
  ShipmentDocumentRecord,
  ShipmentRecord,
  ShortPickRecord,
} from "@/shared/types/domain";
import type { z } from "zod";

import type {
  logisticsTrackingSchema,
  packageExecutionSchema,
  salesOrderEditSchema,
  scanShipSchema,
  shipmentCreateSchema,
  shipmentDocumentSchema,
  waveCreateSchema,
  scanPickSchema,
} from "./validators";

export type {
  DockLoadVerificationRecord,
  LogisticsTrackingEventRecord,
  OutboundWaveRecord,
  PackageExecutionRecord,
  PickTaskRecord,
  SalesOrderRecord,
  ShipmentDocumentRecord,
  ShipmentRecord,
  ShortPickRecord,
};
export type SalesOrderEditValues = z.infer<typeof salesOrderEditSchema>;
export type ShipmentCreateValues = z.infer<typeof shipmentCreateSchema>;
export type WaveCreateValues = z.infer<typeof waveCreateSchema>;
export type PackageExecutionValues = z.infer<typeof packageExecutionSchema>;
export type ShipmentDocumentValues = z.infer<typeof shipmentDocumentSchema>;
export type LogisticsTrackingValues = z.infer<typeof logisticsTrackingSchema>;
export interface SalesOrderUpdatePayload {
  requested_ship_date: string | null;
  reference_code: string;
  notes: string;
}
export type ScanPickValues = z.infer<typeof scanPickSchema>;
export type ScanShipValues = z.infer<typeof scanShipSchema>;
