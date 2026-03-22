# Inbound Operations Module

`operations.inbound` owns purchase orders, advance shipment notices, dock signing, receipt posting, putaway/listing work, CSV import intake, and the current scan-first stock-in slice.

The B2B workbench still reuses this inbound module, but it now does so through a real backend partition. `PurchaseOrder` and `AdvanceShipmentNotice` carry an `order_type` (`STANDARD`, `B2B`, `DROPSHIP`), and the B2B UI scopes its lists and scan actions to `order_type=B2B`.

## Domain Coverage

- `PurchaseOrder` and `PurchaseOrderLine`
- `AdvanceShipmentNotice` and `AdvanceShipmentNoticeLine`
- `InboundSigningRecord`
- `Receipt` and `ReceiptLine`
- `PutawayTask`
- `InboundImportBatch`

## Order Type Partition

- `PurchaseOrder.order_type` is the root inbound partition key.
- `AdvanceShipmentNotice.order_type` mirrors its purchase order.
- Receipt, signing, and putaway records are partitioned indirectly through their linked purchase order.
- Scan flows may pass an expected `order_type`; if the scanned PO/ASN/task belongs to a different partition, the request is rejected.
- The B2B workbench should always query inbound queues with `order_type=B2B`.

## Workflow

1. Create a purchase order and, when needed, an ASN tied to that purchase order.
2. Optionally capture a dock signing record from a scanned PO or ASN when the inbound truck arrives.
3. Post a receipt into a receiving-zone location.
4. Receipt posting creates `RECEIPT` inventory movements, updates ASN/PO progress, and opens putaway tasks.
5. Optional LPN capture creates or updates `scanner.LicensePlate` rows during receipt.
6. Complete the putaway task to move stock into its storage or pick destination and transition the LPN to `STORED`.
7. Bulk CSV imports can post multiple stock-in rows through the same scan-receive validation and store an import batch record with row-level failures.

## Scan-First Slice

- `POST /api/inbound/signing-records/scan-sign/` accepts either purchase-order number or ASN number and writes a dock sign-off record.
- `POST /api/inbound/receipts/scan-receive/` accepts either purchase-order number or ASN number, plus receipt/location/SKU scans, optional LPN, and optional attribute barcode content.
- `POST /api/inbound/putaway-tasks/scan-complete/` accepts task number, source barcode, destination barcode, SKU barcode, and optional LPN.
- `POST /api/inbound/import-batches/upload/` accepts a CSV file and processes each row through the scan-receive service, storing summary and row failure details.
- Scan resolution now supports direct codes plus `scanner.BarcodeAlias` matches.
- Lot and serial parsing is enforced through `scanner.GoodsScanRule` when configured.
- ASN-driven receipt posting updates ASN line progress in the same transaction as the inventory receipt.

## Business Rules

- Purchase order numbers are unique per tenant and immutable once created.
- ASN numbers are unique per tenant and must match the linked purchase order warehouse/supplier.
- Signing numbers are unique per tenant and only allowed against open inbound documents.
- Receipt quantities cannot exceed the remaining ordered quantity on a purchase order line.
- When ASN scope is used, receipt quantities also cannot exceed the remaining ASN quantity.
- Receipts must target active receiving-zone locations in the same warehouse as the purchase order.
- Putaway completion must move stock out of receiving into a putaway-enabled destination.
- Assigned putaway tasks can only be completed by the assigned operator.
- Import rows are processed independently so one bad row does not block the whole stock-in file; failures are stored on the batch record.

## API Surface

- `GET/POST /api/inbound/advance-shipment-notices/`
- `GET/PUT/PATCH /api/inbound/advance-shipment-notices/{id}/`
- `GET/POST /api/inbound/purchase-orders/`
- `GET/PUT/PATCH/DELETE /api/inbound/purchase-orders/{id}/`
- `GET/POST /api/inbound/receipts/`
- `POST /api/inbound/receipts/scan-receive/`
- `GET /api/inbound/receipts/{id}/`
- `GET /api/inbound/signing-records/`
- `POST /api/inbound/signing-records/scan-sign/`
- `GET /api/inbound/signing-records/{id}/`
- `GET /api/inbound/import-batches/`
- `POST /api/inbound/import-batches/upload/`
- `GET /api/inbound/import-batches/{id}/`
- `GET /api/inbound/putaway-tasks/`
- `POST /api/inbound/putaway-tasks/scan-complete/`
- `GET/PUT/PATCH /api/inbound/putaway-tasks/{id}/`
- `POST /api/inbound/putaway-tasks/{id}/complete/`
