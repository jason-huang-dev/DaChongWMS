# Return Operations

`apps.returns` is now the first-class modular returns core. It owns customer return orders after outbound shipment, receives returned stock into the warehouse, and disposes that stock through restock, quarantine, or scrap flows on top of the modular inventory ledger.

## Scope

- `ReturnOrder`: organization-scoped header for an expected customer return, optionally linked to the original sales order.
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
4. The return line and header statuses advance automatically based on received and disposed quantities.

## Current First-Class Contract

- Return orders point at `CustomerAccount` and optionally at a first-class `SalesOrder`.
- Return orders snapshot customer code, name, and contact fields onto the document header.
- Return receipts post `RECEIPT` inventory movements into a returns or quarantine location.
- Restock and quarantine dispositions post `TRANSFER` inventory movements.
- Scrap dispositions post `ADJUSTMENT_OUT` inventory movements.
- Receipt and disposition totals roll up into line and order statuses automatically.

## Validation Rules

- Return order warehouse, customer account, and order type must match the linked sales order when a sales order is provided.
- Return receipts must post into a returns or quarantine zone in the selected warehouse.
- Return receipt quantity cannot exceed the remaining expected quantity on the return line.
- `RESTOCK` only applies to receipts with `AVAILABLE` stock status and must target storage or picking zones.
- `QUARANTINE` only applies to `QUARANTINE` or `DAMAGED` receipts and must target quarantine or returns zones.
- `SCRAP` does not accept a destination location.

## API Surface

- `GET/POST /api/v1/organizations/{organization_id}/returns/return-orders/`
- `GET /api/v1/organizations/{organization_id}/returns/return-orders/{id}/`
- `GET/POST /api/v1/organizations/{organization_id}/returns/receipts/`
- `GET /api/v1/organizations/{organization_id}/returns/receipts/{id}/`
- `GET/POST /api/v1/organizations/{organization_id}/returns/dispositions/`
- `GET /api/v1/organizations/{organization_id}/returns/dispositions/{id}/`
