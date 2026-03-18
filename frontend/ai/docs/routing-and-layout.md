# Routing and Layout

The frontend now uses a guarded application shell that separates login from authenticated warehouse routes.

## Implemented Routes

- `/login`
- `/signup`
- `/mfa/challenge`
- `/security`
- `/dashboard`
- `/mfa/enroll`
- `/inventory/balances`
- `/inbound`
- `/inbound/purchase-orders/:purchaseOrderId`
- `/outbound`
- `/outbound/sales-orders/:salesOrderId`
- `/transfers`
- `/transfers/transfer-orders/:transferOrderId`
- `/returns`
- `/returns/return-orders/:returnOrderId`
- `/counting`
- `/counting/approvals/:approvalId`
- `/automation`
- `/automation/scheduled-tasks/:scheduledTaskId`
- `/automation/background-tasks/:backgroundTaskId`
- `/integrations`
- `/integrations/jobs/:jobId`
- `/integrations/webhooks/:webhookId`
- `/integrations/carrier-bookings/:carrierBookingId`
- `/finance`
- `/finance/invoices/:invoiceId`
- `/not-authorized`

Route configuration lives in `frontend/src/app/routes.tsx`.

## Bundle Strategy

- Route pages are lazy-loaded with `React.lazy`.
- The router wraps each lazy route in a shared suspense fallback so navigation still shows a controlled loading state.
- Vite manual chunking splits React, MUI, React Query, and form libraries into separate bundles to keep the initial payload down.

## Guard Model

- `RequireAuth` blocks all app routes until a valid stored session is restored.
- The MFA challenge route stays outside `RequireAuth` because it runs between password login and full tenant session establishment.
- `RequireRoles` restricts operational and finance sections by backend `staff_type`.
- Navigation items are filtered with the same role map used by the route guards.

## App Shell

`frontend/src/app/layout/app-shell.tsx` provides:

- horizontal role-aware module navigation
- workspace-tab strip backed by persisted membership-scoped tab records
- top bar with breadcrumbs
- workspace/company and warehouse context switcher
- operator identity menu and sign-out action
- responsive drawer behavior for smaller screens

## Breadcrumbs

Breadcrumbs are derived from route metadata through `handle.crumb` values and rendered in `frontend/src/app/layout/route-breadcrumbs.tsx`.

## Current Packaging Rule

Each routed domain packages code using the feature architecture contract in `frontend/ai/docs/feature-architecture.md`:

- `model/` for endpoint contracts, mapper functions, and validators
- `controller/` for query and mutation orchestration
- `view/` for routed pages, tables, forms, and route-local components

Routes must lazy-load page modules from `features/<domain>/view/*`. Shared layout logic stays in `app/layout/`; tables, cards, and formatting that are cross-domain stay in `shared/`.

Scan-first action panels and selector-driven create panels are packaged as route-local view components under the matching domain, for example `features/inbound/view/components/ScanReceivePanel.tsx` and `features/transfers/view/components/CreateTransferOrderPanel.tsx`.

## Current Domain Detail Routes

- Inbound purchase-order detail exposes editable header fields and a cancel action.
- Inbound queue now exposes an overdue-receipts exception lane ahead of the broader purchase-order queue.
- Outbound sales-order detail exposes editable header fields plus allocation/cancel actions.
- Outbound queue now exposes a real short-pick exception lane backed by explicit backend short-pick records and resolution actions, plus a dock-load verification table and status-bucket navigation for trailer confirmation follow-up.
- Transfers expose transfer-order detail plus replenishment task actions.
- Returns expose return-order detail plus receipt/disposition posting panels.
- Counting approval detail exposes approve/reject actions with count-line context, and the parent counting route surfaces blocked-count exception lanes.
- Automation exposes schedule creation, queue monitoring, worker heartbeats, and alert review.
- Automation detail routes expose object-level inspection for scheduled tasks and background tasks.
- Integrations expose job/webhook/carrier booking creation plus execution actions from the same route, along with failed-integration exception lanes.
- Integration detail routes expose object-level inspection for jobs, webhooks, and carrier bookings.
- Finance invoice detail exposes finalize and finance-review actions with invoice-line detail.
- Security exposes company membership provisioning, invite issuance, password-reset issuance, access audit review, staff directory management, role assignment, lock-state control, and a direct path to personal MFA management.

## Next Routing Work

- Split desktop and handheld route trees once scanner-first UX is added.
- Add route-level loaders or prefetch for critical operator flows.

## JF-Inspired Routing And Shell Expansion

The next routing phase should align with `frontend/ai/docs/jf-wms-reference.md`.

### Shell requirements

- support a broad top-level module nav with role-aware visibility
- support optional workspace tabs beneath the global nav
- preserve independent route/filter state per open workspace tab
- allow domain workbench pages to include right-rail utility widgets

The first slice of this is now implemented: module nav is horizontal, workspace tabs are persisted per membership, and dashboard uses a workbench + right-rail layout.

### Domain planning requirements

Treat these as first-class navigational families even if some start as placeholders:

- homepage/workbench
- clients
- products
- inventory
- inbound
- outbound
- cross-border/direct shipping
- dispatch/split workflows
- work orders
- B2B
- returns / FBA returns
- logistics
- fees / billing
- statistics / reporting
- settings / security

### Queue-route requirements

Queue routes should be able to restore:

- active status bucket
- saved view or filter preset
- visible columns
- page size / density
- selected warehouse and company context

This is necessary if we want operators to move between multiple queue tabs without losing context.
