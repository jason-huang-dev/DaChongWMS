# Auth and Permissions

## Domain boundaries
- `apps.accounts`: global authentication identity, user services, and auth-facing API
- `apps.fees`: operational fee records, vouchers, charge catalog, receivable bills, and profit snapshots
- `apps.organizations`: tenant records and memberships
- `apps.iam`: org-scoped roles, groups, permission resolution, and default role bootstrapping
- `apps.partners`: customer accounts and client-account access
- `apps.warehouse`: organization-scoped warehouse records and warehouse API

## Identity model
- A `User` is global.
- Authentication is email-based.
- `username` remains an internal compatibility field derived from email or retained for legacy frontend flows.
- `GET /api/v1/auth/me/` returns the authenticated user, memberships, and any linked customer accounts.

## Compatibility auth/bootstrap layer
The `config` project exposes the legacy-shaped bootstrap endpoints from first-class code:

- `POST /api/login/`
- `POST /api/signup/`
- `POST /api/test-system/register/`
- `GET /api/access/my-memberships/`
- `POST /api/access/my-memberships/{id}/activate/`
- `GET /api/staff/{id}/`
- `GET /api/staff/type/`
- `GET /api/warehouse/`
- `GET /api/mfa/status/`

These compatibility routes keep the current frontend session contract working without a second legacy runtime.

`POST /api/test-system/register/` is a developer-only quick-login path. It resolves a stable default dev account and only creates that account/workspace once if it is missing.

## Security administration compatibility
The `config` project also now serves the frontend security-management endpoints from first-class code:

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

Those endpoints are backed by organization-scoped records and IAM overrides, not by the old company/openid tables.

## Tenancy model
- An `Organization` is the tenant boundary.
- An `OrganizationMembership` connects a user to an organization.
- Memberships carry `membership_type` only:
  - `INTERNAL`
  - `CLIENT`

## Customer account model
- A `CustomerAccount` represents the client account that owns inventory, orders, and charges.
- `ClientAccountAccess` links a client membership to a customer account.
- Client portal permissions should be granted at the customer-account scope, not at the warehouse scope.

## IAM model
- Roles, groups, and overrides are organization-aware.
- Permission definitions come from Django auth `Permission` rows.
- Effective access is resolved from:
  - role assignments
  - group assignments
  - per-user permission overrides
- Scope is optional:
  - no scope = org-wide
  - `WAREHOUSE` scope = one warehouse
  - `RESOURCE` scope = a named resource target such as a customer account

## Default system roles
- `OWNER`
- `MANAGER`
- `STAFF`
- `CLIENT_ADMIN`
- `CLIENT_USER`

These are synced by `python backend/manage.py sync_iam_roles --settings=config.settings.dev`.

## External user rule
- Suppliers are partner master data, not login identities.
- Client users are real organization memberships with `membership_type=CLIENT`.
- Client users should only see their own customer-account data.

## Core API
### `GET /api/v1/auth/me/`
Returns the authenticated user profile plus organization memberships and linked customer accounts.

### `POST /api/v1/organizations/{organization_id}/users/`
Creates or reactivates a membership.

For client users, `customer_account_id` is required so access is scoped correctly.

Request:
```json
{
  "email": "client.user@example.com",
  "full_name": "Client User",
  "membership_type": "CLIENT",
  "customer_account_id": 12,
  "role_code": "CLIENT_USER"
}
```

### `GET /api/v1/organizations/{organization_id}/customer-accounts/`
Lists visible customer accounts for the current user.

### `POST /api/v1/organizations/{organization_id}/customer-accounts/`
Creates a customer account inside the organization.

### `GET /api/v1/organizations/{organization_id}/warehouses/`
Lists organization warehouses.

### `GET /api/v1/organizations/{organization_id}/fees/*`
Operational finance surfaces now live under the organization-scoped `fees` API for recharge/deduction requests, vouchers, manual charges, receivable bills, and related fee records.

## Typing and service boundaries
- New core apps use typed service modules instead of embedding orchestration in views.
- `pyrightconfig.json` enables strict type checking for `backend/apps` and `backend/config`.
- Local stubs for `rest_framework`, `django_filters`, and `dj_database_url` live under `backend/typings`.
- The backend should be extended under `apps/*`; do not introduce a second Django app tree for compatibility code.

## Test commands
```bash
. .venv/bin/activate
python backend/manage.py check --settings=config.settings.dev
python backend/manage.py test apps.accounts.tests apps.fees.tests apps.iam.tests apps.organizations.tests apps.partners.tests apps.warehouse.tests --settings=config.settings.test
```

## Current boundary
- Auth bootstrap, workspace switching, and the current security administration page are available from first-class apps in the `config` project.
- Invite acceptance and password-reset completion are first-class flows.
- Any remaining frontend compatibility is implemented inside `apps.accounts` and `apps.organizations`, not through a separate runtime.
