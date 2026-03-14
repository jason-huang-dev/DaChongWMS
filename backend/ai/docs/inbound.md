# Inbound Operations Module

`operations.inbound` owns purchase orders, advance shipment notices, receipt posting, putaway work, and the current Y2 scan-first receiving slice.

## Domain Coverage

- `PurchaseOrder` and `PurchaseOrderLine`
- `AdvanceShipmentNotice` and `AdvanceShipmentNoticeLine`
- `Receipt` and `ReceiptLine`
- `PutawayTask`

## Workflow

1. Create a purchase order and, when needed, an ASN tied to that purchase order.
2. Post a receipt into a receiving-zone location.
3. Receipt posting creates `RECEIPT` inventory movements, updates ASN/PO progress, and opens putaway tasks.
4. Optional LPN capture creates or updates `scanner.LicensePlate` rows during receipt.
5. Complete the putaway task to move stock into its storage or pick destination and transition the LPN to `STORED`.

## Scan-First Slice

- `POST /api/inbound/receipts/scan-receive/` accepts either purchase-order number or ASN number, plus receipt/location/SKU scans, optional LPN, and optional attribute barcode content.
- `POST /api/inbound/putaway-tasks/scan-complete/` accepts task number, source barcode, destination barcode, SKU barcode, and optional LPN.
- Scan resolution now supports direct codes plus `scanner.BarcodeAlias` matches.
- Lot and serial parsing is enforced through `scanner.GoodsScanRule` when configured.
- ASN-driven receipt posting updates ASN line progress in the same transaction as the inventory receipt.

## Business Rules

- Purchase order numbers are unique per tenant and immutable once created.
- ASN numbers are unique per tenant and must match the linked purchase order warehouse/supplier.
- Receipt quantities cannot exceed the remaining ordered quantity on a purchase order line.
- When ASN scope is used, receipt quantities also cannot exceed the remaining ASN quantity.
- Receipts must target active receiving-zone locations in the same warehouse as the purchase order.
- Putaway completion must move stock out of receiving into a putaway-enabled destination.
- Assigned putaway tasks can only be completed by the assigned operator.

## API Surface

- `GET/POST /api/inbound/advance-shipment-notices/`
- `GET/PUT/PATCH /api/inbound/advance-shipment-notices/{id}/`
- `GET/POST /api/inbound/purchase-orders/`
- `GET/PUT/PATCH/DELETE /api/inbound/purchase-orders/{id}/`
- `GET/POST /api/inbound/receipts/`
- `POST /api/inbound/receipts/scan-receive/`
- `GET /api/inbound/receipts/{id}/`
- `GET /api/inbound/putaway-tasks/`
- `POST /api/inbound/putaway-tasks/scan-complete/`
- `GET/PUT/PATCH /api/inbound/putaway-tasks/{id}/`
- `POST /api/inbound/putaway-tasks/{id}/complete/`
