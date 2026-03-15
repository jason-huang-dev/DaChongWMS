# WMS Product Audit

This audit records the current frontend gaps for the warehouse product and the shared building blocks required to close them. It is the working product-design document for the next frontend iterations.

## Current Screen Audit

### Dashboard

- Strong on summary metrics, weak on queue management.
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
  - short-pick follow-up proxy lane driven by overdue ship-risk orders
- Still needed:
  - explicit short-pick backend events instead of proxy logic
  - wave and route grouping
  - dock-load verification UI

### Transfers

- Implemented this pass:
  - reusable filters, pagination, and saved views for transfer orders, transfer lines, replenishment rules, and replenishment tasks
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
- Still needed:
  - bulk approval actions
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
- Still needed:
  - alert acknowledgement workflow
  - schedule cloning and template presets
  - worker history drill-down

### Integrations

- Implemented this pass:
  - reusable filters, pagination, and saved views for jobs, webhooks, carrier bookings, and logs
  - failed-integration exception lanes for jobs, webhooks, and carrier bookings
- Still needed:
  - payload diff tooling
  - reprocess batching
  - integration health SLA views

### Security

- Before this pass, security was effectively MFA-only.
- Implemented this pass:
  - staff directory management
  - role assignment
  - lock-state control
  - reusable filters and saved views
  - clear link between personal MFA and tenant access management
- Still needed:
  - admin-created browser accounts or invite flow
  - permission matrices beyond coarse `staff_type`
  - audit history for access changes

## Cross-App UX Gaps

- No explicit company model from the backend; current frontend maps tenant scope from `openid`.
- No backend support yet for true multi-company switching in a single login session.
- No backend support yet for warehouse admins to provision login credentials for other users.
- Exception-driven workflows are now visible, but short-pick capture still relies on a frontend proxy because the backend does not emit explicit short-pick records.
- Queue screens still need bulk actions, keyboard-heavy handheld affordances, and stronger status segmentation.

## Shared Frontend Architecture Needed

### 1. Company / Warehouse / User Context

- `TenantScopeProvider` owns the active workspace/company context and the active warehouse selection.
- Today:
  - company scope is synthesized from `openid`
  - warehouse scope comes from `/api/warehouse/`
- Future backend requirement:
  - explicit company API
  - multiple warehouses per company without tier restrictions
  - multi-company membership for a single user
  - warehouse-admin user provisioning endpoints

### 2. Reusable Data View System

- `useDataView(...)` owns filter state, pagination state, and local saved views.
- `DataViewToolbar` renders consistent:
  - filters
  - result counts
  - context chips
  - save/apply/delete view actions
- `ResourceTable` accepts a toolbar slot so every queue uses the same shell.
- `ExceptionLane` packages recurring exception-first table patterns for operator watchlists and escalations.

### 3. Access Management Foundations

- `SecurityPage` is the frontend home for:
  - staff directory
  - role assignment
  - lock state
  - personal MFA posture
- Backend gap:
  - user provisioning/invite/password-reset flows still need dedicated APIs

## Priority Order

1. Company and warehouse context
2. Shared table filtering and saved views
3. Access management UI
4. Queue-specific exception handling
5. Bulk actions and handheld ergonomics

## Backend Dependencies To Track

- dedicated company APIs
- admin-created user provisioning and invite APIs
- richer RBAC than `staff_type`
- explicit short-pick exception endpoints
- warehouse-independent global search endpoints
- audit endpoints for access changes and workflow exceptions
