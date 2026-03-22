# Auth and Permissions

Security is foundational for a warehouse management system. This document reflects the modular backend direction under `backend/apps/*`.

## Authentication stack

- **SessionAuthentication**: browser/admin debugging and Django admin access.
- **BasicAuthentication**: minimal development support in the modular backend.
- Future token/JWT/SSO providers should be added explicitly in `config.settings`.

## Identity and tenancy

- `apps.accounts.User` is the global login identity.
- `apps.organizations.Organization` is the tenant boundary.
- `apps.organizations.OrganizationMembership` grants a user access to an organization.
- Memberships are typed:
  - `INTERNAL`
  - `CLIENT`

## IAM strategy

Authorization is resolved through `apps.iam`:

1. Django auth `Permission` rows define permission codenames.
2. IAM roles and groups grant those permissions.
3. Role/group assignments may be org-wide or scope-specific.
4. Per-user overrides may explicitly allow or deny.

## Scope model

- `scope=None`: org-wide permission
- `WAREHOUSE` scope: one warehouse
- `RESOURCE` scope: one named resource target

For client portal users, the important resource scope is:

- `resource_type="customer_account"`

This is what prevents a client from seeing another client's stock or charges inside the same organization.

## Default role intent

- `OWNER`: full org administration
- `MANAGER`: internal operational administration
- `STAFF`: internal operational read/write subset
- `CLIENT_ADMIN`: external admin for one or more customer-account scopes
- `CLIENT_USER`: external read-only user for one or more customer-account scopes

## Current modular permission surfaces

- Organization user provisioning:
  - internal users require org-wide `iam.manage_memberships`
  - client users may be created with org-wide `iam.manage_memberships`
  - client admins may create client users only within customer accounts where they hold scoped `iam.manage_client_users`
- Warehouse CRUD:
  - internal roles use `warehouse.*` permissions
  - client roles should not receive warehouse admin permissions by default
- Customer account access:
  - internal account administrators use `partners.manage_customer_accounts`
  - client users consume scoped `partners.view_*` permissions
- Work-order scheduling:
  - internal operators use `workorders.view_workorder` to see queue state
  - managers use `workorders.manage_work_order_types` for reusable scheduling templates
  - managers and staff use `workorders.manage_work_orders` to schedule and reprioritize fulfillment
- Logistics:
  - internal roles use `logistics.view_logistics` to view providers, channels, rules, rates, and cost records
  - managers use `logistics.manage_logistics_providers` for providers, groups, customer channels, and waybill watermarking
  - managers use `logistics.manage_logistics_rules` for routing, partition, remote-area, and fuel rules
  - managers use `logistics.manage_logistics_charging` for charging strategies, special customer overrides, and logistics charges
  - managers use `logistics.manage_logistics_costs` for carrier cost capture and reconciliation
- Fees:
  - internal roles use `fees.view_fees` to view the operational fees workspace
  - managers and finance operators use `fees.manage_balance_transactions` to create recharge and deduction records
  - finance reviewers use `fees.review_balance_transactions` to approve or reject recharge and deduction requests
  - managers and finance operators use `fees.manage_vouchers` for voucher issuance and maintenance
  - managers and finance operators use `fees.manage_charge_catalog` for charge items and charge templates
  - managers and finance operators use `fees.manage_manual_charges` for manual charges
  - managers and finance operators use `fees.manage_fund_flows` for fund-flow records
  - managers and finance operators use `fees.manage_rent_details` for rent accrual detail
  - managers and finance operators use `fees.manage_business_expenses` for business-expense tracking
  - managers and finance operators use `fees.manage_receivable_bills` for receivable bills
  - managers and finance operators use `fees.manage_profit_calculations` for profitability snapshots

## Portal rule of thumb

Suppliers are partner records, not login identities, unless a real supplier portal use case appears.

Customers/clients are the external login use case. Their access should be:

- account-scoped
- read-only by default
- expanded only when a workflow requires it, such as inbound submission
