# Outbound Operations

`operations.outbound` owns sales orders, allocation, picking, explicit short-pick capture, shipment posting, dock-load verification, and the current Y2 scan-first shipping slice.

## Scope

- `SalesOrder` and `SalesOrderLine`
- `PickTask`
- `ShortPickRecord`
- `Shipment` and `ShipmentLine`
- `DockLoadVerification`

## Workflow

1. Create a sales order.
2. Allocate inventory and generate pick tasks.
3. Complete picks into the staging location or report an explicit short-pick against the pick task.
4. Optional LPN capture moves the pallet/carton to `scanner.LicensePlateStatus.STAGED`.
5. Post shipment confirmation and record the `SHIP` inventory movement.
6. Optional dock-load verification records trailer/dock confirmation and transitions the LPN to `LOADED`.
7. Capture a billing charge event for shipment handling.

## Scan-First Slice

- `POST /api/outbound/pick-tasks/scan-complete/` accepts task number, source barcode, destination barcode, SKU barcode, and optional LPN barcode.
- `POST /api/outbound/shipments/scan-ship/` accepts sales-order number, shipment number, staging-location barcode, SKU barcode, shipped quantity, optional dock/LPN scans, and optional lot/serial attribute data.
- Shipping scans append to an existing shipment when the shipment number already exists, otherwise they create the shipment header on first scan.
- Scan resolution now supports direct codes plus `scanner.BarcodeAlias` matches.
- LPN-based shipping requires the scanned quantity to match the LPN quantity.

## Validation Rules

- Allocation ignores locked, maintenance, or non-pickable locations.
- Pick completion must move stock from the source location into staging atomically.
- Shipment posting and scan-ship must use the sales order warehouse and staging location.
- Assigned pick tasks can only be completed by the assigned operator.
- Reporting a short pick places the missing quantity into an explicit exception record instead of relying on derived overdue-order heuristics.
- Resolving a short pick requires the same outbound-capable roles as pick completion and records the operator plus resolution note.
- Scan-ship requires an already picked quantity for the matching sales-order line.
- When scan-ship includes a dock location, the dock location must still be an active shipping-zone location in the same warehouse.

## API Surface

- `GET/POST /api/outbound/sales-orders/`
- `GET/PUT/PATCH/DELETE /api/outbound/sales-orders/{id}/`
- `POST /api/outbound/sales-orders/{id}/allocate/`
- `GET /api/outbound/pick-tasks/`
- `POST /api/outbound/pick-tasks/scan-complete/`
- `GET/PUT/PATCH /api/outbound/pick-tasks/{id}/`
- `POST /api/outbound/pick-tasks/{id}/complete/`
- `POST /api/outbound/pick-tasks/{id}/report-short-pick/`
- `GET /api/outbound/short-picks/`
- `GET /api/outbound/short-picks/{id}/`
- `POST /api/outbound/short-picks/{id}/resolve/`
- `GET/POST /api/outbound/shipments/`
- `POST /api/outbound/shipments/scan-ship/`
- `GET /api/outbound/shipments/{id}/`
- `GET /api/outbound/dock-load-verifications/`
- `GET /api/outbound/dock-load-verifications/{id}/`

## Operator UI Expectation

- The frontend outbound console should show short-pick exceptions and dock-load verification in the same operational workspace so supervisors can move from exception review to trailer confirmation without context switching.
