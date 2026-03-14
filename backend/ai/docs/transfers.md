# Transfer and Replenishment Operations

`operations.transfers` owns internal stock movements after receipt and before shipment. It covers operator-driven transfer orders plus rule-based replenishment into pick faces and other forward locations.

## Scope

- `TransferOrder`: the header for planned internal moves inside a warehouse.
- `TransferLine`: the executable line that moves a SKU from one location to another and records the resulting inventory transfer movement.
- `ReplenishmentRule`: the min/max policy for a SKU between a source location and a target location.
- `ReplenishmentTask`: the generated work item created when a rule detects that the target location has dropped below its minimum quantity.

## Workflow

1. Create a transfer order with one or more lines.
2. Assign transfer lines when a specific operator should execute the work.
3. Complete each line to post an inventory `TRANSFER` movement from the source location to the destination location.
4. Configure replenishment rules for forward pick faces or other target locations.
5. Generate a replenishment task from a rule when the target location falls below its minimum quantity.
6. Assign and complete the replenishment task to move stock from the source location into the target location.

## Validation Rules

- Transfer source and destination locations must belong to the selected warehouse and cannot be the same location.
- Completed transfer lines and replenishment tasks are immutable once the inventory movement posts.
- Transfer order status is system-managed from line completion state; only cancellation is user-driven.
- Replenishment rules require `target_qty > minimum_qty`.
- Replenishment generation refuses to create a task when the target location is already at or above its minimum quantity.
- Replenishment tasks pull from a concrete source balance so lot/serial and unit cost stay traceable through the movement ledger.

## Permissions

- Mutation endpoints require `HTTP_OPERATOR` and a staff role of `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- Read-only list and detail endpoints stay tenant-scoped but do not require an operator header.

## API Surface

- `GET/POST /api/transfers/transfer-orders/`
- `GET/PUT/PATCH/DELETE /api/transfers/transfer-orders/{id}/`
- `GET /api/transfers/transfer-lines/`
- `GET/PUT/PATCH /api/transfers/transfer-lines/{id}/`
- `POST /api/transfers/transfer-lines/{id}/complete/`
- `GET/POST /api/transfers/replenishment-rules/`
- `GET/PUT/PATCH/DELETE /api/transfers/replenishment-rules/{id}/`
- `POST /api/transfers/replenishment-rules/{id}/generate-task/`
- `GET /api/transfers/replenishment-tasks/`
- `GET/PUT/PATCH /api/transfers/replenishment-tasks/{id}/`
- `POST /api/transfers/replenishment-tasks/{id}/complete/`
