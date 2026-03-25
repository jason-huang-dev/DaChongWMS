# Outbound Operations

`apps.outbound` is now the first-class modular outbound core. It owns sales orders, allocation, pick completion, and shipment posting on top of the modular `inventory`, `locations`, `products`, `partners`, `warehouse`, and `organizations` apps.

It also owns the outbound order catalog that powers the package board in the UI. In practice that means `SalesOrder` is the operational order/package header, not just a minimal ERP reference.

The migrated first-class surface is intentionally narrower than the legacy one: waves, package execution, shipment documents, logistics tracking, dock-load verification, and short-pick exception management are still legacy references for now.

## Scope

- `SalesOrder` and `SalesOrderLine`
- `PickTask`
- `Shipment` and `ShipmentLine`

## Order Type Partition

- `SalesOrder.order_type` is the root outbound partition key.
- The first-class app already supports `STANDARD`, `B2B`, and `DROPSHIP`.
- Pick tasks and shipments inherit partition scope through their linked sales order.
- The B2B UI should query outbound queues and reference selectors with `order_type=B2B`.
- Dropshipping orders must point at a first-class `CustomerAccount`.

## Sales Order Header Contract

`SalesOrder` now includes the metadata required by the package board and the client/account context needed for dropshipping:

- warehouse, customer account, staging location
- customer-account snapshot fields: `customer_code`, `customer_name`, `customer_contact_name`, `customer_contact_email`, `customer_contact_phone`
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

1. Create a sales order and snapshot the linked customer account onto the order header.
2. Allocate inventory and generate pick tasks from pickable balances.
3. Complete picks into the staging location.
4. Post shipment confirmation and decrement staged stock.
5. Hand off richer package execution, tracking, and dock-load workflows to the remaining legacy outbound references until those slices are migrated.

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

Exception rules remain on the order header, but detailed short-pick / package-exception records are still legacy.

## Validation Rules

- Allocation ignores locked, maintenance, or non-pickable locations.
- Pick completion must move stock from the source location into staging atomically.
- Shipment posting and scan-ship must use the sales order warehouse and staging location.
- Dropshipping orders must reference a `CustomerAccount` that allows dropshipping.
- Each dropshipping order persists customer-account snapshot fields so downstream reporting and client-facing order views do not depend on mutable master data alone.

## API Surface

- `GET/POST /api/v1/organizations/{organization_id}/outbound/sales-orders/`
- `GET/PATCH /api/v1/organizations/{organization_id}/outbound/sales-orders/{id}/`
- `POST /api/v1/organizations/{organization_id}/outbound/sales-orders/{id}/allocate/`
- `POST /api/v1/organizations/{organization_id}/outbound/sales-orders/{id}/ship/`
- `GET /api/v1/organizations/{organization_id}/outbound/pick-tasks/`
- `GET /api/v1/organizations/{organization_id}/outbound/pick-tasks/{id}/`
- `POST /api/v1/organizations/{organization_id}/outbound/pick-tasks/{id}/complete/`
- `GET /api/v1/organizations/{organization_id}/outbound/shipments/`
- `GET /api/v1/organizations/{organization_id}/outbound/shipments/{id}/`

## Operator UI Expectation

- The frontend outbound console should show both low-level workflow status and the higher-level package-board bucket.
- Customer-facing or client-portal views should use the same order header but must be permission-scoped so external users only see their own orders, packages, stock, and charges.
- The dropshipping order detail should surface both ship-to fields and the persisted customer-account snapshot.
- The remaining wave / package-execution / tracking depth is still legacy and should be migrated separately rather than reintroduced into this first-class core ad hoc.
