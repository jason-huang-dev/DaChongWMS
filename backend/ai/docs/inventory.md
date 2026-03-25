# Inventory Module

The first-class `apps.inventory` module provides the current stock picture and the audit trail behind it. It builds on `apps.locations.Location`, `apps.products.Product`, `apps.warehouse.Warehouse`, and `apps.organizations.Organization`.

## Domain Coverage

- `InventoryBalance` is the current state per organization, warehouse, location, product, lot, serial, and stock status.
- `InventoryMovement` is the append-only stock ledger used for opening balances, receipts, transfers, picks, shipments, adjustments, and hold transitions.
- `InventoryHold` is the explicit reservation/hold record that reduces available quantity without changing on-hand quantity.
- `InventoryAdjustmentReason` defines the approved business reason codes used by count and adjustment workflows.
- `InventoryAdjustmentApprovalRule` defines when a given reason code must be approved, by which role, and optionally for which warehouse.
- `apps.transfers` is now the first-class internal-move and replenishment consumer of this stock ledger.
- Legacy return and reporting modules still read inventory state for now, but the modular backend source of truth is now `apps.inventory`.

## Operator Workbench Expectations

- The frontend inventory module is now expected to surface six operator views from this domain stack: inventory information, stock-count review, internal move monitoring, stock-age reporting, manual inventory adjustment, and inter-warehouse transfer planning.
- Stock count is still owned by counting workflows; inventory provides the balance state, reason codes, and approval rules that those workflows consume.
- Internal move execution now posts through the first-class movement ledger with `movement_type=PUTAWAY|TRANSFER`.
- Manual adjustment posting is fulfilled through `POST /api/v1/organizations/{organization_id}/inventory/movements/` with `movement_type=ADJUSTMENT_IN|ADJUSTMENT_OUT`.
- Dedicated warehouse-to-warehouse transfer requests are still not implemented. The current inventory module can support planning visibility across warehouses, but executable cross-warehouse transfer orchestration still needs a separate transfer-request workflow.

## Business Rules

- Inventory balances are unique per `(location, product, lot_number, serial_number, stock_status)` tuple.
- `available_qty = on_hand_qty - allocated_qty - hold_qty`; allocated plus hold quantity may never exceed on-hand quantity.
- Inventory mutations are applied through movement or hold workflows; balances are read-only from the API.
- Movement records are append-only. They should not be edited or deleted once created.
- Source and destination locations must belong to the selected organization and warehouse.
- Count-driven adjustments must use an active adjustment reason code, and rule evaluation is based on the absolute variance quantity.
- Adjustment rules are warehouse-specific when present; otherwise a global rule can apply for the organization.

## API Surface

- `GET /api/v1/organizations/{organization_id}/inventory/balances/`
- `GET /api/v1/organizations/{organization_id}/inventory/balances/{inventory_balance_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/inventory/movements/`
- `GET /api/v1/organizations/{organization_id}/inventory/movements/{inventory_movement_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/inventory/holds/`
- `GET|PATCH /api/v1/organizations/{organization_id}/inventory/holds/{inventory_hold_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/inventory/adjustment-reasons/`
- `GET|PATCH /api/v1/organizations/{organization_id}/inventory/adjustment-reasons/{inventory_adjustment_reason_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/inventory/adjustment-approval-rules/`
- `GET|PATCH /api/v1/organizations/{organization_id}/inventory/adjustment-approval-rules/{inventory_adjustment_approval_rule_id}/`

## Permissions

- Read access requires `inventory.view_inventory`.
- Movement and hold mutations require `inventory.manage_inventory_records`.
- Adjustment reason and approval-rule configuration require `inventory.manage_inventory_configuration`.
- Hold release actions record the releasing actor and append a `RELEASE_HOLD` movement for traceability.

## Validation & Auditability

- Source and destination locations must belong to the selected warehouse and organization.
- Outbound movements cannot reduce a balance below its allocated and held quantities.
- Opening balances and inbound movements automatically create a balance record if one does not already exist for the exact stock key.
- Each successful mutation stamps both the acting operator and resulting balance quantities in the movement history.
- `apps.inventory` is the runtime source of truth for stock state and stock movement in the supported backend.
