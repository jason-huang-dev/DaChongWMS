import type { PurchaseOrderRecord } from "@/features/inbound/model/types";

export type PurchaseOrderLineQuantityField = "ordered_qty" | "received_qty";

export interface PurchaseOrderSummary {
  lineCount: number;
  orderedQty: number;
  receivedQty: number;
}

export function sumPurchaseOrderLineQuantity(
  purchaseOrder: PurchaseOrderRecord,
  field: PurchaseOrderLineQuantityField,
) {
  return (purchaseOrder.lines ?? []).reduce((total, line) => total + Number(line?.[field] ?? 0), 0);
}

export function summarizePurchaseOrders(purchaseOrders: PurchaseOrderRecord[]): PurchaseOrderSummary {
  return purchaseOrders.reduce<PurchaseOrderSummary>(
    (summary, purchaseOrder) => ({
      lineCount: summary.lineCount + (purchaseOrder.lines?.length ?? 0),
      orderedQty: summary.orderedQty + sumPurchaseOrderLineQuantity(purchaseOrder, "ordered_qty"),
      receivedQty: summary.receivedQty + sumPurchaseOrderLineQuantity(purchaseOrder, "received_qty"),
    }),
    {
      lineCount: 0,
      orderedQty: 0,
      receivedQty: 0,
    },
  );
}

export function isActivePurchaseOrderStatus(status?: string | null) {
  return status === "OPEN" || status === "PARTIAL";
}
