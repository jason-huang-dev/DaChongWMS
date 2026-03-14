# Return Operations

`operations.returns` owns customer return orders after outbound shipment. It receives returned stock into the warehouse, then disposes that stock through restock, quarantine, or scrap flows on top of the inventory ledger.

## Scope

- `ReturnOrder`: tenant-scoped header for an expected customer return, optionally linked to the original sales order.
- `ReturnLine`: the SKU-level expectation and progress for each returned item.
- `ReturnReceipt`: the posted warehouse receipt into a returns or quarantine location.
- `ReturnDisposition`: the inspection outcome that restocks, quarantines, or scraps received goods.

## Workflow

1. Create a return order with one or more line items.
2. Receive returned goods into a returns or quarantine location.
3. Inspect and dispose the receipt quantity through one of three paths:
   - `RESTOCK` moves available stock into a storage or picking location.
   - `QUARANTINE` moves quarantined or damaged stock into a quarantine/returns location.
   - `SCRAP` removes received stock through an inventory adjustment-out movement.
4. Return receipt posting also records a zero-rated `reporting.BillingChargeEvent` so 3PL billing can rate return-handling work later.
5. The return line and header statuses advance automatically based on received and disposed quantities.

## Validation Rules

- Return order warehouse and customer must match the linked sales order when a sales order is provided.
- Return receipts must post into a returns or quarantine zone in the selected warehouse.
- Return receipt quantity cannot exceed the remaining expected quantity on the return line.
- `RESTOCK` only applies to receipts with `AVAILABLE` stock status and must target storage or picking zones.
- `QUARANTINE` only applies to `QUARANTINE` or `DAMAGED` receipts and must target quarantine or returns zones.
- `SCRAP` does not accept a destination location.
- Return orders with posted receipts or dispositions cannot be archived or cancelled.

## Permissions

- Mutation endpoints require `HTTP_OPERATOR` and a staff role of `Manager`, `Supervisor`, `Inbound`, `Outbound`, or `StockControl`.
- Read-only list and detail endpoints stay tenant-scoped but do not require an operator header.

## API Surface

- `GET/POST /api/returns/return-orders/`
- `GET/PUT/PATCH/DELETE /api/returns/return-orders/{id}/`
- `GET/POST /api/returns/receipts/`
- `GET /api/returns/receipts/{id}/`
- `GET/POST /api/returns/dispositions/`
- `GET /api/returns/dispositions/{id}/`
