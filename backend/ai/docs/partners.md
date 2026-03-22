# Partner & Financial Master Data

The partner domain covers suppliers, customers, and transportation partners. In the new modular backend this should converge under `apps.partners`, while the legacy `supplier` / `customer` Django apps remain migration sources.

## Conceptual split

- **Supplier**: a business partner that sends inbound goods. This is not an auth/login concept.
- **Customer account**: the client account that owns stock, orders, and charges inside the WMS.
- **Client portal user**: a login identity linked to an organization membership with `membership_type=CLIENT`, then scoped to one or more customer accounts.

## Current modular direction

- `apps.partners.CustomerAccount` is the new source of truth for client accounts in the modular backend.
- `apps.partners.ClientAccountAccess` links a client membership to the customer accounts it may access.
- IAM scoping for client portal users is done with `AccessScope(scope_type=RESOURCE, resource_type="customer_account")`.
- `CustomerAccount` should carry operational client metadata needed by the portal and ops team, not just a name/code pair. The current MVP fields should include:
  - `name`
  - `code`
  - `contact_name`
  - `contact_email`
  - `contact_phone`
  - `billing_email`
  - `shipping_method`
  - `allow_dropshipping_orders`
  - `allow_inbound_goods`
  - `notes`
  - `is_active`

## Business rules

- Suppliers and customers remain master data, not authentication principals.
- External portal access should be **customer-account scoped**, not warehouse scoped.
- A client user should only see:
  - their inventory
  - their inbound / outbound activity
  - their charges and invoices
- A client user should not see:
  - warehouse configuration
  - staffing or admin tools
  - other customers' data

## Recommended access defaults

- `CLIENT_ADMIN`
  - manage client users for their customer account scope
  - view account inventory, orders, and charges
  - submit dropshipping orders when enabled for the account
  - optionally submit inbound goods / ASNs
- `CLIENT_USER`
  - read-only access to account inventory, orders, and charges

## Frontend contract

- The SPA should expose a dedicated `Clients` route/tab for internal operators.
- Managers and other authorized operations roles use that page to create and maintain customer accounts before attaching external client memberships.
- Customer-account records are the right place to store dropshipping-order and inbound-submission capability flags. Do not model those capabilities on the global user.

## Migration note

Legacy `customer.ListModel` and `supplier.ListModel` still exist as old tenant/openid-backed tables. New feature work should target `apps.partners` and only use the legacy tables as migration references until downstream operational domains are moved.
