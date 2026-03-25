# Inbound Operations

`apps.inbound` is now the first-class modular inbound core. It owns purchase orders, advance shipment notices, receipt posting, and putaway execution on top of the modular `inventory`, `locations`, `products`, `partners`, `warehouse`, and `organizations` apps.

The migrated first-class surface is intentionally narrower than the legacy inbound stack: dock signing, CSV import batches, scan-first receive/list flows, and deeper LPN orchestration are still legacy references for now.

The B2B workbench still reuses this inbound domain through a real backend partition. `PurchaseOrder` and `AdvanceShipmentNotice` carry an `order_type` (`STANDARD`, `B2B`, `DROPSHIP`), and the B2B UI scopes its lists and execution to `order_type=B2B`.

## Domain Coverage

- `PurchaseOrder` and `PurchaseOrderLine`
- `AdvanceShipmentNotice` and `AdvanceShipmentNoticeLine`
- `Receipt` and `ReceiptLine`
- `PutawayTask`

## Order Type Partition

- `PurchaseOrder.order_type` is the root inbound partition key.
- `AdvanceShipmentNotice.order_type` mirrors its purchase order.
- Receipt, signing, and putaway records are partitioned indirectly through their linked purchase order.
- Scan flows may pass an expected `order_type`; if the scanned PO/ASN/task belongs to a different partition, the request is rejected.
- The B2B workbench should always query inbound queues with `order_type=B2B`.

## Workflow

1. Create a purchase order and, when needed, an ASN tied to that purchase order.
2. Post a receipt into a receiving-zone location.
3. Receipt posting creates `RECEIPT` inventory movements, updates ASN/PO progress, and opens putaway tasks.
4. Complete the putaway task to move stock into its storage or pick destination.
5. Keep the remaining scan-first, signing, import, and richer LPN workflows in the legacy inbound references until those slices are migrated intentionally.

## Current First-Class Contract

- Purchase orders persist customer-account snapshot fields and supplier snapshot fields on the document header.
- ASNs inherit warehouse, customer account, and order type from the purchase order.
- Receipts must post into active receiving locations in the same warehouse as the purchase order.
- Receipt posting updates PO and ASN progress in the same transaction as the inventory receipt movement.
- Putaway completion creates a `PUTAWAY` movement from the receipt location into the final destination.
- The first-class API supports list/create/detail for purchase orders, ASNs, and receipts, plus list/detail/complete for putaway tasks.

## Business Rules

- Purchase order numbers are unique per organization and immutable once created.
- ASN numbers are unique per organization and must match the linked purchase order warehouse, customer account, and order type.
- Receipt quantities cannot exceed the remaining ordered quantity on a purchase order line.
- When ASN scope is used, receipt quantities also cannot exceed the remaining ASN quantity.
- Receipts must target active receiving-zone locations in the same warehouse as the purchase order.
- Putaway completion must move stock out of receiving into a putaway-enabled destination.
- Assigned putaway tasks can only be completed by the assigned operator.

## API Surface

- `GET/POST /api/v1/organizations/{organization_id}/inbound/purchase-orders/`
- `GET /api/v1/organizations/{organization_id}/inbound/purchase-orders/{id}/`
- `GET/POST /api/v1/organizations/{organization_id}/inbound/asns/`
- `GET /api/v1/organizations/{organization_id}/inbound/asns/{id}/`
- `GET/POST /api/v1/organizations/{organization_id}/inbound/receipts/`
- `GET /api/v1/organizations/{organization_id}/inbound/receipts/{id}/`
- `GET /api/v1/organizations/{organization_id}/inbound/putaway-tasks/`
- `GET /api/v1/organizations/{organization_id}/inbound/putaway-tasks/{id}/`
- `POST /api/v1/organizations/{organization_id}/inbound/putaway-tasks/{id}/complete/`
