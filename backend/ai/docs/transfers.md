# Transfer and Replenishment Operations

The first-class `apps.transfers` module owns internal stock movements after receipt and before shipment. It builds directly on `apps.inventory`, `apps.locations`, `apps.products`, `apps.warehouse`, and `apps.organizations`.

## Scope

- `TransferOrder`: the header for planned internal moves inside a warehouse.
- `TransferLine`: the executable line that moves a SKU from one location to another and records the resulting inventory transfer movement.
- `ReplenishmentRule`: the min/max policy for a SKU between a source location and a target location.
- `ReplenishmentTask`: the generated work item created when a rule detects that the target location has dropped below its minimum quantity.
- Line and task assignment is now org-scoped through `OrganizationMembership` rather than the old legacy staff model.

## Workflow

1. Create a transfer order with one or more lines.
2. Assign transfer lines when a specific operator should execute the work.
3. Complete each line to post an inventory `TRANSFER` movement from the source location to the destination location.
4. Configure replenishment rules for forward pick faces or other target locations.
5. Generate a replenishment task from a rule when the target location falls below its minimum quantity.
6. Assign and complete the replenishment task to move stock from the source location into the target location.

## Validation Rules

- Transfer source and destination locations must belong to the selected organization and warehouse and cannot be the same location.
- Source and destination locations must be active, unlocked, and in `AVAILABLE` status when a move is posted.
- Completed transfer lines and replenishment tasks are immutable once the inventory movement posts.
- Transfer order status is system-managed from line completion state; only cancellation is user-driven.
- Replenishment rules require `target_qty > minimum_qty`.
- Replenishment generation refuses to create a task when the target location is already at or above its minimum quantity.
- Replenishment tasks pull from a concrete source balance so lot/serial and unit cost stay traceable through the movement ledger.
- Replenishment destinations are limited to picking, storage, or shipping zones.

## Permissions

- Read access requires the org-scoped IAM permission `transfers.view_transfers`.
- Transfer-order and transfer-line mutation endpoints require `transfers.manage_transfer_orders`.
- Replenishment-rule and replenishment-task mutation endpoints require `transfers.manage_replenishment`.

## API Surface

- `GET|POST /api/v1/organizations/{organization_id}/transfer-orders/`
- `GET|PATCH /api/v1/organizations/{organization_id}/transfer-orders/{transfer_order_id}/`
- `GET /api/v1/organizations/{organization_id}/transfer-lines/`
- `GET|PATCH /api/v1/organizations/{organization_id}/transfer-lines/{transfer_line_id}/`
- `POST /api/v1/organizations/{organization_id}/transfer-lines/{transfer_line_id}/complete/`
- `GET|POST /api/v1/organizations/{organization_id}/replenishment-rules/`
- `GET|PATCH /api/v1/organizations/{organization_id}/replenishment-rules/{replenishment_rule_id}/`
- `POST /api/v1/organizations/{organization_id}/replenishment-rules/{replenishment_rule_id}/generate-task/`
- `GET /api/v1/organizations/{organization_id}/replenishment-tasks/`
- `GET|PATCH /api/v1/organizations/{organization_id}/replenishment-tasks/{replenishment_task_id}/`
- `POST /api/v1/organizations/{organization_id}/replenishment-tasks/{replenishment_task_id}/complete/`
