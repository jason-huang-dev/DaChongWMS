# Locations Module

The first-class `apps.locations` module models the physical warehouse topology that inventory, inbound, outbound, and transfer flows work against. It sits directly on top of `apps.organizations` and `apps.warehouse`.

## Domain Coverage

- `Zone` groups warehouse space by operational purpose such as receiving, storage, picking, shipping, quarantine, or returns.
- `LocationType` defines reusable slot behavior and capacity defaults such as pallet, shelf, floor, or staging positions.
- `Location` represents the actual physical bin or slot used for putaway and picking.
- `LocationLock` records operational holds such as maintenance, quarantine, recount, or safety blocks.

## Business Rules

- Every record is explicitly organization-scoped through `organization_id`.
- Zone codes are unique per warehouse; location type codes are unique per organization; location codes are unique per warehouse.
- A location's warehouse, zone, and location type must all belong to the same organization, and the zone must belong to the same warehouse as the location.
- Only one active lock can exist for a location at a time.
- When an active lock exists, the location is marked `is_locked=True` and moved to `BLOCKED`; when the last active lock is released, the location reverts to `AVAILABLE`.

## API Surface

- `GET|POST /api/v1/organizations/{organization_id}/zones/`
- `GET|PATCH /api/v1/organizations/{organization_id}/zones/{zone_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/location-types/`
- `GET|PATCH /api/v1/organizations/{organization_id}/location-types/{location_type_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/locations/`
- `GET|PATCH /api/v1/organizations/{organization_id}/locations/{location_id}/`
- `GET|POST /api/v1/organizations/{organization_id}/location-locks/`
- `GET|PATCH /api/v1/organizations/{organization_id}/location-locks/{location_lock_id}/`

## Validation & Security

- Read access requires the org-scoped IAM permission `locations.view_locations`.
- Topology changes require `locations.manage_location_topology`.
- Lock creation and release require `locations.manage_location_locks`.
- The API resolves `locked_by` / `released_by` from the authenticated user when the client omits them, so clients do not have to trust a free-form actor payload.
- `apps.locations` is the runtime source of truth for warehouse topology in the supported backend.
