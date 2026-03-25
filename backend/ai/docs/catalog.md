# Catalog Domains

The backend has two different "catalog" concepts and they should not be mixed together.

## 1. Product Catalog

The typed product-management domain now lives under `backend/apps/products/`.

Core models:

| Model | Purpose |
| --- | --- |
| `Product` | Organization-scoped product master with SKU, barcode, UOM, category, brand, description, and active state. |
| `DistributionProduct` | Client-account-specific distribution mapping for external SKU/name/channel plus dropship and inbound rights. |
| `ProductSerialConfig` | Serial-number policy for a product, including tracking mode, capture points, uniqueness, and optional pattern. |
| `ProductPackaging` | Unit/carton/pallet/custom packaging specs with dimensions, weight, and default-pack flag. |
| `ProductMark` | Handling/compliance/operator-facing marks such as fragile, battery, temperature, or custom labels. |

The old grouped catalog models now live under `backend/apps/legacy/catalog/` as legacy data-modeling material, but new browser-facing product work should target `apps/products`.

Rules for the new module:

- Product rows are organization-scoped through `Product.organization`.
- `Product.sku` is the stable warehouse SKU identifier used by downstream workflows.
- Distribution products link the warehouse SKU to a client-facing SKU/channel instead of duplicating the core product row.
- Serial settings, packaging, and marks are separated into dedicated sub-resources so product management stays modular.
- The new API surface lives under `/api/v1/organizations/<organization_id>/products/...`.

Frontend guidance:

- The product-management route is `/products`.
- Select a product first, then manage:
  - distribution products
  - serial number management
  - packaging
  - product marks

## 2. Order Catalog / Package Board

The order catalog is the operational package board used by fulfillment teams. It lives in `backend/apps/legacy/operations/outbound/` and is implemented on top of `SalesOrder`.

`SalesOrder` is no longer just a thin order header. It now carries the metadata needed for the board shown in the package console:

- warehouse
- customer
- staging location
- logistics provider
- shipping method
- tracking number
- waybill number and print state
- deliverer and receiver details
- package count, type, weight, and dimensions
- order time, create time, picking timestamps, packed time, and expiration time
- operational status
- fulfillment stage bucket
- anomaly / interception state

### Fulfillment stage buckets

`SalesOrder.fulfillment_stage` powers the package-board buckets:

- `GET_TRACKING_NO`
- `TO_MOVE`
- `IN_PROCESS`
- `TO_SHIP`
- `SHIPPED`
- `CANCELLED`

Expected meaning:

- `GET_TRACKING_NO`: order exists but no tracking / waybill data has been prepared yet
- `TO_MOVE`: tracking or waybill data exists, but warehouse work has not started
- `IN_PROCESS`: allocation, picking, or packing work is in progress
- `TO_SHIP`: packed and ready to dispatch
- `SHIPPED`: shipment has posted

### Anomaly states

`SalesOrder.exception_state` is separate from the operational status so abnormal and intercepted orders can still move through the board:

- `NORMAL`
- `ABNORMAL_PACKAGE`
- `ORDER_INTERCEPTION`

Behavior:

- open short-picks mark the order as `ABNORMAL_PACKAGE`
- resolving the last open short-pick returns the order to `NORMAL`
- manual interception should use `ORDER_INTERCEPTION` and should not be overwritten by normal fulfillment refreshes

## API expectations

For outbound order APIs:

- `SalesOrder.status` remains the low-level workflow state (`OPEN`, `ALLOCATED`, `PICKING`, `PICKED`, `SHIPPED`, `CANCELLED`)
- `SalesOrder.fulfillment_stage` is the UI-facing queue bucket
- `packed_at` is writable from the order header because a separate packing task model does not exist yet
- `picking_started_at` and `picking_completed_at` are system-managed from allocation / pick completion
- `waybill_printed_at` is system-managed from the `waybill_printed` flag

## Design guidance

- Do not add receiver / tracking / logistics fields to `Product`; they belong to outbound order headers.
- Do not treat supplier or customer master data as auth or account records; those remain partner records.
- If the frontend says "catalog" but is showing packages or orders, back it with `operations.outbound.SalesOrder`, not the SKU catalog apps.
