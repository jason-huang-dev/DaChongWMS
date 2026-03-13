# Inventory Module

The `inventory` app provides the current stock picture and the audit trail behind it. It builds directly on `locations.Location` and `catalog.goods.ListModel`.

## Domain Coverage

- `InventoryBalance` is the current state per tenant, warehouse, location, goods, lot, serial, and stock status.
- `InventoryMovement` is the append-only stock ledger used for opening balances, receipts, transfers, picks, shipments, adjustments, and hold transitions.
- `InventoryHold` is the explicit reservation/hold record that reduces available quantity without changing on-hand quantity.

## Business Rules

- Inventory balances are unique per active `(openid, location, goods, lot_number, serial_number, stock_status)` tuple.
- `available_qty = on_hand_qty - allocated_qty - hold_qty`; allocated plus hold quantity may never exceed on-hand quantity.
- Inventory mutations are applied through movement or hold workflows; balances are read-only from the API.
- Movement records are append-only. They should not be edited or deleted once created.
- Locations under maintenance or lock may not be used for stock movements.

## API Surface

- `GET /api/inventory/balances/`
- `GET /api/inventory/balances/{id}/`
- `GET/POST /api/inventory/movements/`
- `GET /api/inventory/movements/{id}/`
- `GET/POST /api/inventory/holds/`
- `GET/PUT/PATCH/DELETE /api/inventory/holds/{id}/`

## Permissions

- Read access follows authenticated tenant scoping.
- Unsafe methods require `HTTP_OPERATOR` and an active staff role of `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- Hold release actions record the releasing operator and append a `RELEASE_HOLD` movement for traceability.

## Validation & Auditability

- Source and destination locations must belong to the selected warehouse and tenant.
- Outbound movements cannot reduce a balance below its allocated and held quantities.
- Opening balances and inbound movements automatically create a balance record if one does not already exist for the exact stock key.
- Each successful mutation stamps both the acting operator and resulting balance quantities in the movement history.
