# WMS Product Audit

This audit records the current frontend gaps for the warehouse product and the shared building blocks required to close them. It is the working product-design document for the next frontend iterations.

## Current Screen Audit

### Dashboard

- Strong on summary metrics, weak on queue management.
- Implemented this pass:
  - workbench-style dashboard layout with right rail
  - persisted workbench time-window preference
- Needed next:
  - saved dashboard layouts by role
  - KPI drill-down routing from every summary tile
  - cross-warehouse exception rollups for leadership users

### Inventory

- Core balances are visible, but investigation workflow was weak before the filter layer.
- Implemented this pass:
  - active warehouse scoping
  - reusable filters
  - saved views
- Still needed:
  - movement history drill-down
  - hold/release actions
  - lot/serial/location deep links

### Inbound

- Receipt and putaway actions exist, but real dock teams need queue reuse and clearer segmentation.
- Implemented this pass:
  - reusable table filters and saved views for purchase orders, receipts, and putaway tasks
  - warehouse-scoped queue browsing
  - overdue receipt exception lane for late inbound demand
- Still needed:
  - ASN-first dock planning
  - exception handling for short, over, and damaged receipts
  - dock appointment and trailer status visibility

### Outbound

- Pick/ship flows exist, but outbound needs better queue control and exception focus.
- Implemented this pass:
  - reusable table filters and saved views for sales orders, pick tasks, and shipments
  - warehouse-scoped queue browsing
  - explicit short-pick exception lane backed by real backend short-pick records
  - JF-style status bucket navigation with visible counts
  - dock-load verification kept in the same workbench as shipment exceptions
- Still needed:
  - wave and route grouping
  - dock door assignment and trailer-queue management beyond the current verification table

### Transfers

- Implemented this pass:
  - reusable filters, pagination, and saved views for transfer orders, transfer lines, replenishment rules, and replenishment tasks
  - bulk archive flow for transfer orders on the filtered queue
- Still needed:
  - bulk completion/release flows
  - replenishment hot-list prioritization by pick-face risk
  - operator assignment controls

### Returns

- Implemented this pass:
  - reusable filters, pagination, and saved views for return orders, receipts, and dispositions
- Still needed:
  - exception handling for damaged / quarantine returns
  - customer-service context and reason-code analytics
  - disposition batching

### Counting

- Implemented this pass:
  - reusable filters and saved views for supervisor approvals and handheld assignments
  - blocked-count exception lanes for approval breaches and recount breaches
  - bulk approve / reject actions for filtered approval queues
- Still needed:
  - blind-count specific views
  - handheld-friendly large-target layout

### Finance

- Implemented this pass:
  - reusable filters, pagination, and saved views for invoices, settlements, disputes, and finance exports
- Still needed:
  - remittance and credit-note action flows
  - downloadable artifacts from queue rows
  - finance workbench segmentation by reviewer role

### Automation

- Implemented this pass:
  - reusable filters, pagination, and saved views for schedules, background tasks, worker heartbeats, and alerts
  - bulk run-now actions for filtered scheduled-task queues
- Still needed:
  - alert acknowledgement workflow
  - schedule cloning and template presets
  - worker history drill-down

### Integrations

- Implemented this pass:
  - reusable filters, pagination, and saved views for jobs, webhooks, carrier bookings, and logs
  - failed-integration exception lanes for jobs, webhooks, and carrier bookings
  - bulk retry/start for filtered job queues where the backend can restart failed or queued jobs
  - bulk reprocess for filtered webhook queues
  - carrier-booking retry and rebook actions for failed booking recovery
- Still needed:
  - payload diff tooling
  - integration health SLA views
  - carrier escalation policies beyond retry / rebook / cancel

### Security

- Before this pass, security was effectively MFA-only.
- Implemented this pass:
  - company membership provisioning for browser users
  - invite issuance for new browser users
  - password-reset token issuance and revocation
  - access-audit review
  - staff directory management
  - role assignment
  - lock-state control
  - reusable filters and saved views
  - clear link between personal MFA and tenant access management
- Still needed:
  - public invite-acceptance and password-reset completion screens
  - permission matrices beyond coarse `staff_type`
  - audit history for access changes

## Cross-App UX Gaps

- Company membership, invite issuance, reset issuance, and audit review now exist, but the browser experience still needs public invite-acceptance and reset-completion screens.
- Bulk actions now exist on the main queues where the backend exposes safe endpoints, but several domains still need deeper bulk workflow coverage.
- Queue screens still need keyboard-heavy handheld affordances and stronger status segmentation.

## Shared Frontend Architecture Needed

### 1. Company / Warehouse / User Context

- `TenantScopeProvider` owns the active workspace/company context and the active warehouse selection.
- Today:
  - company scope comes from `/api/access/my-memberships/`
  - company switching uses membership activation
  - warehouse scope comes from `/api/warehouse/`
- Still needed from the backend:
  - richer role/permission models than `staff_type`
  - access audit detail/export endpoints beyond the current list feed
  - mail delivery or notification hooks for invite/reset distribution

### 2. Reusable Data View System

- `useDataView(...)` owns filter state, pagination state, and local saved views.
- `DataViewToolbar` renders consistent:
  - filters
  - result counts
  - context chips
  - save/apply/delete view actions
- `ResourceTable` accepts a toolbar slot so every queue uses the same shell.
- `ExceptionLane` packages recurring exception-first table patterns for operator watchlists and escalations.
- `useBulkSelection(...)`, `BulkActionBar`, and `executeBulkAction(...)` package reusable bulk queue actions so controllers do not rebuild row selection and batch feedback from scratch.

### 3. Access Management Foundations

- `SecurityPage` is the frontend home for:
  - company membership provisioning
  - staff directory
  - role assignment
  - lock state
  - personal MFA posture
- Backend gap:
  - public invite acceptance, password-reset completion, and notification delivery still need dedicated browser flows


## JF WMS Reference Alignment

The next frontend phase should use `frontend/ai/docs/jf-wms-reference.md` as the external reference model for high-density enterprise workflows. The goal is to emulate the functional shape of JF WMS, especially:

- broad top-level module navigation
- operational homepages instead of static dashboards
- multi-row advanced filter bars on queue pages
- status-bucket secondary navigation with counts
- strong bulk-action and export affordances
- configurable table workbenches for power users

This means the product audit priorities now extend beyond filling isolated CRUD gaps. The next work should close the gap between our current route set and a true operator console.

## Additional Gaps Exposed By The JF Reference

### Global shell and navigation

- Implemented this pass:
  - backend-backed workspace-tab model for parallel queue work
  - horizontal top-level module navigation
  - right-rail workbench pattern on dashboard
- Still needed:
  - more modules at the top level than the current operational surface
  - workspace-tab restore of full queue state, not just route/context
  - right-rail notices/download widgets on non-dashboard modules

### Queue system

- Implemented this pass:
  - denser shared queue filter band
  - backend models for queue-view persistence
  - status segmentation now starts on outbound
- Still needed:
  - wider mixed-type filter coverage across more routes
  - column personalization wired end to end
- column personalization, dense-mode preference, and refresh/help controls are not yet a shared contract
- export is not uniformly available across queue pages

### Domain coverage

- client and product modules now have first-class route treatment
- logistics should grow beyond integration records into an operator-facing logistics workbench
- fee/billing flows need a workbench model closer to JF's finance/fees posture
- reporting/statistics need explicit role-oriented routes rather than being implied by dashboard cards

## Reprioritized Delivery Sequence

1. Extend the new queue workbench primitives aligned to `jf-wms-reference.md`
2. Expand the dashboard/workbench redesign into inbound, outbound, finance, and logistics module landing pages
3. Finish backend-backed saved-view and column preference wiring
4. Deeper domain coverage for clients, products, logistics, fees, and statistics
5. Remaining workflow exceptions and handheld ergonomics

## Priority Order

1. Company and warehouse context
2. Shared table filtering and saved views
3. Access management UI
4. Queue-specific exception handling
5. Bulk actions and handheld ergonomics

## Backend Dependencies To Track

- richer RBAC than `staff_type`
- warehouse-independent global search endpoints
- audit detail routes and downloadable audit exports
