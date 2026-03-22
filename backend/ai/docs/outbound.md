# Outbound Operations

`operations.outbound` owns sales orders, allocation, picking, explicit short-pick capture, shipment posting, dock-load verification, outbound waves, package execution, shipment documents, and logistics tracking.

It also owns the outbound order catalog that powers the package board in the UI. In practice that means `SalesOrder` is the operational order/package header, not just a minimal ERP reference.

The B2B workbench is now backed by a real outbound partition instead of a frontend-only view. `SalesOrder` and `OutboundWave` carry `order_type` (`STANDARD`, `B2B`, `DROPSHIP`), and outbound operational records are filtered through that root order type.

## Scope

- `SalesOrder` and `SalesOrderLine`
- `PickTask`
- `ShortPickRecord`
- `Shipment` and `ShipmentLine`
- `OutboundWave` and `OutboundWaveOrder`
- `PackageExecutionRecord`
- `ShipmentDocumentRecord`
- `LogisticsTrackingEvent`
- `DockLoadVerification`

## Order Type Partition

- `SalesOrder.order_type` is the root outbound partition key.
- `OutboundWave.order_type` is derived from its assigned sales orders, and a wave cannot mix order types.
- Pick tasks, shipments, package executions, shipment documents, tracking events, short picks, and dock-load verifications inherit partition scope through their linked sales order.
- Package execution requests can include `requested_order_type`; mismatches are rejected so B2B panels cannot accidentally write into standard or dropship orders.
- The B2B UI should query outbound queues and reference selectors with `order_type=B2B`.

## Sales Order Header Contract

`SalesOrder` now includes the metadata required by the package board:

- warehouse, customer, staging location
- order number, order time, requested ship date, expiration time
- logistics provider, shipping method, tracking number, waybill number
- waybill print state and print timestamp
- package count, package type, weight, and dimensions
- deliverer and receiver identity / address fields
- low-level status
- UI-facing fulfillment stage bucket
- anomaly / interception state
- picking start / completion timestamps
- packed timestamp

## Workflow

1. Create a sales order.
2. Optionally batch released work into an `OutboundWave`.
3. Allocate inventory and generate pick tasks.
4. Complete picks into the staging location or report an explicit short-pick against the pick task.
5. Optional LPN capture moves the pallet/carton to `scanner.LicensePlateStatus.STAGED`.
6. Record package execution milestones for relabel, pack, inspect, and weigh.
7. Generate manifest, photo, and scanform records as shipment-supporting documents.
8. Post shipment confirmation and record the `SHIP` inventory movement.
9. Record logistics tracking events after handover to the carrier.
10. Optional dock-load verification records trailer/dock confirmation and transitions the LPN to `LOADED`.
11. Capture a billing charge event for shipment handling.

## Additional Operational Records

### Waves

- `OutboundWave` groups active sales orders for warehouse-controlled release.
- `OutboundWaveOrder` stores the per-wave sales order assignments and sequence.
- A sales order can only belong to one active wave at a time.

### Package execution

- `PackageExecutionRecord.step_type` supports `RELABEL`, `PACK`, `INSPECT`, and `WEIGH`.
- `RELABEL` is intended for B2B or channel-specific relabel execution before final packing.
- Pack and weigh records can advance the order into the packed / `TO_SHIP` state by setting `SalesOrder.packed_at`.
- Flagged inspect or weigh records mark the order as `ABNORMAL_PACKAGE` unless the order is already explicitly intercepted.

### Shipment documents

- `ShipmentDocumentRecord.document_type` supports `MANIFEST`, `PHOTO`, and `SCANFORM`.
- `SCANFORM` generation marks the order waybill as printed.

### Logistics tracking

- `LogisticsTrackingEvent` stores carrier or handover milestones by tracking number.
- Exception tracking events can promote the order into the abnormal package queue.

## Package Board Buckets

The package-board counters should be computed from `SalesOrder.fulfillment_stage` plus `SalesOrder.exception_state`.

Primary buckets:

- `GET_TRACKING_NO`
- `TO_MOVE`
- `IN_PROCESS`
- `TO_SHIP`
- `SHIPPED`

Exception buckets:

- `ABNORMAL_PACKAGE`
- `ORDER_INTERCEPTION`

Stage derivation rules:

- shipping / shipment posting drives `SHIPPED`
- packed orders with no shipment yet are `TO_SHIP`
- allocated or actively picked orders are `IN_PROCESS`
- orders with label / tracking data but no warehouse work yet are `TO_MOVE`
- orders with no label / tracking data yet are `GET_TRACKING_NO`

Exception rules:

- reporting a short-pick marks the sales order as `ABNORMAL_PACKAGE`
- resolving the last open short-pick clears the order back to `NORMAL`
- manual intercepts should use `ORDER_INTERCEPTION`

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
- `GET/POST /api/outbound/waves/`
- `GET/PUT/PATCH /api/outbound/waves/{id}/`
- `GET/POST /api/outbound/package-executions/`
- `GET /api/outbound/package-executions/{id}/`
- `GET/POST /api/outbound/shipment-documents/`
- `GET /api/outbound/shipment-documents/{id}/`
- `GET/POST /api/outbound/tracking-events/`
- `GET /api/outbound/tracking-events/{id}/`
- `GET /api/outbound/dock-load-verifications/`
- `GET /api/outbound/dock-load-verifications/{id}/`

## Operator UI Expectation

- The frontend outbound console should show both low-level workflow status and the higher-level package-board bucket.
- Supervisors need short-pick exceptions, intercept/anomaly queues, wave status, package execution, shipping documents, tracking events, and dock-load verification in the same workspace so they can move from exception review to trailer confirmation without context switching.
- Customer-facing or client-portal views should use the same order header but must be permission-scoped so external users only see their own orders, packages, stock, and charges.
- The frontend B2B workbench exposes a narrower outbound path on top of this module and now enforces that path through the shared `order_type=B2B` partition instead of a separate outbound data model.
