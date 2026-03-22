# Accounts, Organizations, IAM, Partners, and Warehouse

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
- `username` is an internal compatibility field derived from email.
- `GET /api/v1/auth/me/` returns the authenticated user, memberships, and any linked customer accounts.

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
- The new backend should be extended under `apps/*`; legacy top-level modules remain migration targets.

## Test commands
```bash
. .venv/bin/activate
python backend/manage.py check --settings=config.settings.dev
python backend/manage.py test apps.accounts.tests apps.fees.tests apps.iam.tests apps.organizations.tests apps.partners.tests apps.warehouse.tests --settings=config.settings.test
```
