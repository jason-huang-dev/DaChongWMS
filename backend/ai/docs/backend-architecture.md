# Backend Architecture

DaChongWMS is moving to a modular backend rooted in `backend/apps/*` and booted by `backend/config/*`.

## Current source of truth

1. **Entry + Configuration**: `config.settings.*`, `config.asgi`, and `config.wsgi`
2. **Core modular apps**:
   - `apps.accounts`
   - `apps.fees`
   - `apps.organizations`
   - `apps.iam`
   - `apps.logistics`
   - `apps.partners`
   - `apps.workorders`
   - `apps.warehouse`
3. **Service layer**: app-local `services/` modules hold multi-model orchestration
4. **API layer**: app-local `api/` packages expose DRF views and URL wiring

## New domain boundaries

- `accounts`: authentication identity
- `fees`: operational recharge, deduction, vouchers, charging catalog, receivable billing, expense tracking, and profit snapshots
- `organizations`: tenancy and memberships
- `iam`: roles, groups, scopes, permission resolution
- `logistics`: provider masters, provider channels, customer channel mappings, routing rules, surcharges, charging strategy, logistics charges, and logistics costs
- `partners`: customer accounts and client-account access
- `workorders`: fulfillment scheduling, urgency, and work-order type templates
- `warehouse`: organization-scoped warehouse master data

## External access model

- Supplier records are partner master data, not login identities.
- Client portal users are `accounts.User` identities with `membership_type=CLIENT`.
- Client access is limited through IAM resource scopes tied to `partners.CustomerAccount`.

## App layout template

```text
backend/apps/<app_name>/
  models.py
  services/
  api/
  permissions.py
  admin.py
  tests/
```

## Legacy status

The old top-level Django apps under `backend/` still exist and remain migration targets:

- `access`
- `warehouse`
- `inventory`
- `locations`
- `operations/*`
- `reporting`
- `scanner`
- `userlogin`
- `userprofile`
- `customer`
- `supplier`

New feature work should prefer `apps/*` unless a migration shim is explicitly required.
