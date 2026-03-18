# JF WMS Reference Model

This document captures the product patterns we should emulate from Jifeng WMS / JF WMS for the next implementation phase. It is not a copy spec. It is a functional reference so Codex can infer the missing platform behaviors and package them into our app using our own architecture.

## Source References

Use these as the external product references:

- Official help center: https://help.jfwms.com/en_US
- Official product site: https://www.jfwms.com/en_US

The help center shows that Jifeng WMS supports overseas warehouse operations, integrations with mainstream ERP and e-commerce workflows, and published tutorials around OMS pairing, product mapping, manual order creation, and warehouse-related operations. The product site positions JF WMS as a multi-business-model overseas warehouse and logistics platform. These references justify treating JF as a broad, operator-heavy WMS rather than a narrow inventory app.

## Observed UX Patterns From Reference Screens

### 1. Dense top-level module navigation

The primary shell uses a wide horizontal nav with business modules such as:

- Homepage
- Client
- Product
- Inventory
- Stock In
- Stock Out
- Cross-border Direct Shipping
- Pickup-Split-Dispatch
- Work Order
- B2B
- FBA Returns
- Logistics
- Fees
- Statistics

Implication for our frontend:

- The app shell must support many first-class warehouse domains without collapsing into a single generic sidebar.
- We should keep the global nav stable and role-aware.
- Overflow handling matters because the product surface is intentionally broad.

### 2. Tabbed multi-task workspace

The screenshots show a browser-like tab strip beneath the global nav. Operators can keep multiple work surfaces open at once, for example homepage, product list, client list, settings, charging items, and stock-out list.

Implication for our frontend:

- Support optional workspace tabs for power users.
- Preserve filter state, scroll position, and active record context per tab.
- Routing should allow opening a new task in the current tab or a new workspace tab.

### 3. Module homepages are operational workbenches

The homepage is not a marketing dashboard. It is a live workbench with:

- queue summary cards
- weekly / monthly / yearly stats
- storage-capacity widgets
- fee widgets
- system notifications
- help center shortcuts
- operations contact panel
- quick entry into core queue states

Implication for our frontend:

- Each major domain should have a role-based workbench, not just a raw table.
- Dashboard tiles must drill into filtered queues.
- Right-rail widgets for alerts, notices, help, and downloads are legitimate enterprise patterns.

### 4. Queue pages are filter-first

The stock-out list screenshot is dominated by multi-row filters before the table. It includes tenant/client, order source, package type, reshipment flag, print state, shipping status, interception status, platform, store, logistics group, logistics provider, aisle, product type, product quantity range, date range, identifier type selector, free-text content search, precision search toggle, and reset.

Implication for our frontend:

- Queue pages need a reusable advanced filter bar, not a couple of inputs above a table.
- Filters should support mixed types: selects, ranges, date windows, scoped search-by selectors, and saved views.
- Search should allow users to choose the identifier field first, then enter the value.

### 5. Queue pages include state-driven secondary navigation

The stock-out screen includes a left rail with queue states like All Packages, Get Tracking No, To Move, In Process Orders, To Ship, Shipped, Abnormal Package, and Order Interception.

Implication for our frontend:

- Each major queue should support status buckets as first-class navigation, not only as chips inside a single table.
- Status counts should be visible before opening the table results.
- Exception lanes should live beside or above the main queue.

### 6. Batch actions are prominent

The stock-out page exposes actions such as Generate Wave, Print, Mark as Abnormal, and Export before the table grid.

Implication for our frontend:

- Bulk selection and bulk actions should be first-class patterns.
- Toolbars must support primary and secondary queue actions.
- Export is part of the core queue contract, not a later add-on.

### 7. Column, density, and table controls matter

The screenshot shows controls for selection presets, refresh, help, download/export, and likely table customization.

Implication for our frontend:

- Resource tables need configurable visible columns.
- Dense mode is important.
- Refresh, export, and “what does this queue mean?” style help affordances belong in the shared table shell.

## Functional Model We Should Emulate

The target product should behave like a configurable, multi-tenant, multi-warehouse operator console.

### Company and warehouse model

- A user may belong to one company or many companies.
- Each company may have many warehouses.
- The active company and warehouse must scope queues, dashboards, permissions, and lookup options.
- Leadership users also need cross-warehouse rollups.

### Operational domains

At minimum, our navigation and route planning should assume these families:

- Homepage / workbench
- Client management
- Product / SKU management
- Inventory
- Inbound / stock in
- Outbound / stock out
- Cross-border / channel-specific fulfillment
- Split / dispatch / routing workflows
- Work orders and internal operations
- B2B
- Returns, including FBA-oriented returns
- Logistics
- Fees / billing
- Reporting / statistics
- Settings / security / access

### Common queue contract

Every operational list page should eventually support:

- status buckets with visible counts
- dense advanced filters
- saved views
- column personalization
- export
- batch actions
- queue refresh
- drill-down to detail page
- per-row actions
- search-by selector + search value
- date range filtering
- warehouse-aware and company-aware context chips

### Homepage contract

The homepage should support:

- queue summary cards
- short-horizon stats filters like this week / this month / this year
- financial snapshots
- storage capacity widgets
- system notifications
- operational help center shortcuts
- contacts / escalation area
- optional customization of visible cards by role

## Implementation Rules For Codex

When implementing JF-inspired functionality, Codex should follow these rules:

1. Reuse the existing feature architecture; do not create ad-hoc page-level fetch logic.
2. Prefer shared queue primitives over one-off filter layouts.
3. Build for multi-company and multi-warehouse operation from the start.
4. Treat status buckets, filters, saved views, export, and bulk actions as default queue capabilities.
5. Add role-aware workbench pages for major modules instead of making every route a plain table.
6. Keep the UI dense and enterprise-oriented, but still consistent with MUI accessibility and theming.
7. Implement our own naming, branding, and domain models; use JF only as a behavioral reference.

## Immediate Build Priorities Triggered By This Reference

1. Application shell upgrade for broad top-level navigation and optional workspace tabs.
2. Shared advanced queue filter bar with mixed filter types.
3. Shared status-bucket secondary navigation with counts.
4. Shared bulk-action and export toolbar.
5. Homepage / workbench redesign around operational widgets and queue drill-downs.
6. Route and domain expansion so inventory, inbound, outbound, logistics, billing, and reporting feel like first-class modules.
