# Locations Module

The `locations` app models the physical warehouse topology that inventory will be assigned to. It sits between `warehouse` and future stock/inbound/outbound apps.

## Domain Coverage

- `Zone` groups locations by operating purpose such as receiving, storage, picking, shipping, quarantine, or returns.
- `LocationType` defines reusable slot behavior and capacity defaults such as pallet, shelf, floor, or staging positions.
- `Location` represents the actual physical bin or slot used for putaway and picking.
- `LocationLock` records operational holds such as maintenance, quarantine, recount, or safety blocks.

## Business Rules

- Every record is tenant-scoped by `openid` and soft-deleted through `is_delete`.
- Zone codes are unique per tenant warehouse; location codes are unique per tenant warehouse.
- A location's zone must belong to the selected warehouse.
- Only one active lock can exist for a location at a time.
- When an active lock exists, the location is marked `is_locked=True` and moved to `BLOCKED`; when the last active lock is archived, the location reverts to `AVAILABLE`.

## API Surface

- `GET/POST /api/locations/zones/`
- `GET/PUT/PATCH/DELETE /api/locations/zones/{id}/`
- `GET/POST /api/locations/types/`
- `GET/PUT/PATCH/DELETE /api/locations/types/{id}/`
- `GET/POST /api/locations/`
- `GET/PUT/PATCH/DELETE /api/locations/{id}/`
- `GET/POST /api/locations/locks/`
- `GET/PUT/PATCH/DELETE /api/locations/locks/{id}/`

## Validation & Security

- All CRUD paths enforce tenant scoping via `request.auth.openid`.
- Unsafe methods require `HTTP_OPERATOR`; topology changes are limited to `Manager`/`Supervisor`, while lock changes also allow `StockControl`.
- Zones and location types cannot be archived while active locations still reference them.
- Location barcodes default to `location_code` if the caller does not provide one.
- `creator` is now derived from the resolved operator record for mutation requests, rather than trusting the client payload.
