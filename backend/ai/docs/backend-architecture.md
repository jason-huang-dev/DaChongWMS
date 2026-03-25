# Backend Architecture

## Current source of truth
The modular backend now lives under `backend/apps/*` and is booted by `backend/config/*`.

### Installed apps in the new backend
- `apps.accounts`
- `apps.fees`
- `apps.organizations`
- `apps.iam`
- `apps.inventory`
- `apps.inbound`
- `apps.logistics`
- `apps.locations`
- `apps.partners`
- `apps.products`
- `apps.reporting`
- `apps.counting`
- `apps.outbound`
- `apps.returns`
- `apps.transfers`
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
- `backend/manage.py` now defaults to `config.settings.dev`
- `backend/config/settings/base.py` is the shared settings module
- `backend/config/wsgi.py` and `backend/config/asgi.py` are the canonical server entrypoints
- `backend/config/urls.py` is the canonical root URLConf

## Shared helper boundary
- Root-level `backend/utils` has been removed.
- First-class shared helpers now live under `backend/apps/common/*`.
- New first-class apps should keep helpers local to the app unless the helper is clearly cross-cutting enough to belong in `apps.common`.

## Typing policy
- Strict editor type checking is configured in `pyrightconfig.json`
- `pyrightconfig.json` now points `stubPath` at `backend/typings`
- Local third-party stubs should stay under `backend/typings/*`
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
- inventory
- inbound
- logistics
- locations
- partners / customer accounts
- products
- reporting
- counting
- outbound
- returns
- transfers
- work orders
- warehouse

### First-class compatibility bridge now in place
These legacy-shaped bootstrap endpoints are now served from the first-class `config` project and backed by `apps.accounts`, `apps.organizations`, and `apps.warehouse`:
- `POST /api/login/`
- `POST /api/signup/`
- `GET /api/access/my-memberships/`
- `POST /api/access/my-memberships/{id}/activate/`
- `GET /api/staff/{id}/`
- `GET /api/staff/type/`
- `GET /api/warehouse/`
- `GET /api/mfa/status/`
- `GET /api/access/workspace-tabs/`
- `POST /api/access/workspace-tabs/sync/`
- `GET|PATCH /api/access/workbench-preferences/current/`

These are compatibility endpoints only. They exist so the current frontend shell can bootstrap against the modular backend.

### Security administration now migrated on the `config` stack
The first-class backend also now owns the security page APIs the frontend uses:
- `GET|POST /api/staff/`
- `GET|PATCH /api/staff/{id}/`
- `GET|POST /api/access/company-memberships/`
- `GET|PATCH /api/access/company-memberships/{id}/`
- `GET|POST /api/access/company-invites/`
- `POST /api/access/company-invites/accept/`
- `POST /api/access/company-invites/{id}/revoke/`
- `GET|POST /api/access/password-resets/`
- `POST /api/access/password-resets/complete/`
- `POST /api/access/password-resets/{id}/revoke/`
- `GET /api/access/audit-events/`

These are backed by first-class organization-scoped records under `apps.organizations`:
- `OrganizationStaffProfile`
- `OrganizationInvite`
- `OrganizationPasswordReset`
- `OrganizationAccessAuditEvent`

### Not yet rebuilt as first-class apps
- scanner device orchestration beyond the handheld flows already exposed by `apps.inbound`, `apps.outbound`, and `apps.counting`
- background automation and integration-job orchestration
- advanced invoice, settlement, remittance, dispute, and finance-export workflows

## Recommended next migration order
1. scanner device orchestration and logistics/integration cutovers
2. advanced billing and finance-export workflows under first-class reporting/fees apps
