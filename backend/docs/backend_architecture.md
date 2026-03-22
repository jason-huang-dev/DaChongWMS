# Backend Architecture

## Current source of truth
The modular backend now lives under `backend/apps/*` and is booted by `backend/config/*`.

### Installed apps in the new backend
- `apps.accounts`
- `apps.fees`
- `apps.organizations`
- `apps.iam`
- `apps.logistics`
- `apps.partners`
- `apps.workorders`
- `apps.warehouse`

## Project layout
Each new app follows the same structure:
- `models.py`: persistence layer only
- `services/`: business logic and orchestration
- `api/`: DRF views and URL registration
- `permissions.py`: request-level authorization rules
- `admin.py`: admin registration
- `tests/`: app-local tests

## Runtime entrypoints
- `backend/manage.py` defaults to `config.settings.dev`
- `backend/config/settings/base.py` is the shared settings module
- `backend/config/urls.py` is the root URLConf

## Typing policy
- Strict editor type checking is configured in `pyrightconfig.json`
- New code should use:
  - `from __future__ import annotations`
  - explicit return types
  - typed dataclasses for service inputs
  - app-local service modules instead of untyped view orchestration

## Migration status
### Migrated to `apps/*`
- auth/accounts
- fees
- organizations
- IAM
- logistics
- partners / customer accounts
- work orders
- warehouse

### Still legacy and not yet migrated
- `backend/access`
- `backend/warehouse`
- `backend/inventory`
- `backend/locations`
- `backend/operations/*`
- `backend/reporting`
- `backend/scanner`
- `backend/userlogin`
- `backend/userprofile`
- `backend/customer`
- `backend/supplier`

Those modules should be treated as legacy references until each domain is intentionally moved into a corresponding `apps/*` package.

## Recommended next migration order
1. inventory
2. locations
3. inbound / outbound / transfers / returns / counting
4. reporting and integrations
5. remove or archive legacy top-level apps once callers are cut over
