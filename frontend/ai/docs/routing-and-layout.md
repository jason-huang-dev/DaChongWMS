# Routing and Layout

The frontend now uses a guarded application shell that separates login from authenticated warehouse routes.

## Implemented Routes

- `/login`
- `/signup`
- `/mfa/challenge`
- `/security`
- `/dashboard`
- `/mfa/enroll`
- `/inventory`
- `/inbound`
- `/inbound/purchase-orders/:purchaseOrderId`
- `/outbound`
- `/outbound/sales-orders/:salesOrderId`
- `/transfers`
- `/transfers/transfer-orders/:transferOrderId`
- `/returns`
- `/returns/return-orders/:returnOrderId`
- `/clients`
- `/clients/pending-approval`
- `/clients/approved`
- `/clients/review-not-approved`
- `/clients/deactivated`
- `/products`
- `/logistics`
- `/work-orders`
- `/b2b`
- `/counting`
- `/statistics`
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

The quality standard for future routing changes lives in `frontend/ai/docs/change-quality.md`.

## Module Notes

- `/inbound` is now a stock-in workbench rather than a single receipt table. It includes anchored sections for standard stock-in, stock-in list management, scan-to-sign, scan-to-receive, scan-to-list, import-to-stock-in, import management, returns-to-stock, return order management, and the inbound record queues. The standard stock-in list now uses a dedicated filter-card + sticky-table composition instead of the generic toolbar table, with status tabs, route-restorable search/date filters, and saved views kept in the table toolbar.
- `/outbound` is now a package and shipping workbench rather than only sales orders plus shipments. It includes anchored sections for package management, stock-out package execution, interception management, abnormal packages, wave management, secondary picking, shipping management, manifest/photo/scanform records, logistics tracking, short-pick follow-up, and dock-load verification.
- `/work-orders` is a scheduling workbench. It includes work-order type management for reusable urgency/SLA templates and work-order management for warehouse-scoped prioritization, assignee planning, and fulfillment sequencing.
- `/logistics` is a logistics configuration and financial-control workbench. It includes online/offline channels, provider masters, customer channel assignments, logistics rules, partition rules, remote-area rules, fuel rules, waybill watermarking, charging strategies, customer-specific charging overrides, operational logistics charges, and carrier-side logistics costs.
- `/b2b` is a dedicated customer-replenishment workbench built on top of the shared inbound and outbound modules. It includes B2B stock-in list management, scan-to-receive, scan-to-list, B2B stock-out list management, scan-and-relabel, scan-to-pack, and the inbound record tables most relevant to B2B operations.
- `/finance` is now the operational fees workbench. It includes recharge/deduction review, voucher management, charging items, charging templates, manual charging, fee inquiries, fund flow, rent details, business expenses, receivable bills, and profit calculation. The legacy invoice detail route remains under `/finance/invoices/:invoiceId`.
- `/statistics` is now a read-only warehouse statistics workbench. It aggregates inbound, outbound, returns, direct-shipping, warehouse-analysis, and staff-performance metrics from the existing operational APIs instead of introducing a separate reporting-only backend domain.

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
- top bar locale and light/dark mode controls
- workspace/company and warehouse context switcher
- operator identity menu and sign-out action
- responsive drawer behavior for smaller screens

## Sticky Table Workspace Standard

Dense queue and list pages should use the bounded sticky-table workspace pattern instead of allowing the document body to grow with rows.

- `app-shell.tsx` owns the viewport and navbar. The shell is fixed to `100dvh` and the authenticated content area owns page-level scrolling.
- `shared/components/sticky-table-layout/sticky-table-layout.tsx` owns the page split between normal chrome above and the bounded table workspace below.
- `shared/components/data-table/data-table.tsx` owns row scrolling. The `TableContainer` is the only vertical row-scroll container; toolbar and pagination stay outside that scroll area.
- `shared/components/data-table/data-table.tsx` also owns opt-in sticky left/right columns, so action rails can stay pinned without page-specific table forks.

### Standard scroll interaction

This is the default scroll-interaction contract for every page that uses the bounded sticky-table workspace with `shared/components/data-table/data-table.tsx`.

When a sticky-table page has filters or tabs above the table, use `shared/hooks/use-collapsible-table-page-chrome.ts` instead of implementing page-specific scroll collapse logic.

- collapse starts after a short threshold rather than immediately on the first wheel tick
- the page chrome eases toward the collapsed state on `requestAnimationFrame`
- the collapse is driven by table-body scroll, not document scroll
- the interaction is measured from the actual page-chrome height, so wrapped filters still collapse cleanly

Current `DataTable` pages using this standard:

- `features/clients/view/ClientAccountTable.tsx`
- `features/inbound/view/components/StockInListManagementSection.tsx`
- `features/inventory/view/InventoryInformationTable.tsx`
- `features/inventory/view/InventoryMovementsPage.tsx`

Implementation rules for new list pages:

- wrap filters/tabs in `StickyTableLayout.pageChrome` or `filters`
- mount `DataTable` with `fillHeight` and `stickyHeader`
- pass `useCollapsibleTablePageChrome().handleTableScrollStateChange` into `DataTable.onScrollStateChange`
- wrap the page chrome in the hook's `wrapperRef` / `contentRef` container pair
- do not add per-page `scrollTop` state or direct scroll scrubbing when this shared interaction already applies

## Breadcrumbs

Breadcrumbs are derived from route metadata through `handle.crumb` values and rendered in `frontend/src/app/layout/route-breadcrumbs.tsx`. The breadcrumb renderer now passes labels through the shared translation layer so route metadata can remain stable while the UI swaps between English and Simplified Chinese.

## Current Packaging Rule

Each routed domain packages code using the feature architecture contract in `frontend/ai/docs/feature-architecture.md`:

- `model/` for endpoint contracts, mapper functions, and validators
- `controller/` for query and mutation orchestration
- `view/` for routed pages, tables, forms, and route-local components
- `test/` for feature-local route, table, dialog, and model coverage

Routes must lazy-load page modules from `features/<domain>/view/*`. Shared layout logic stays in `app/layout/`; tables, cards, and formatting that are cross-domain stay in `shared/`.

## Routing Growth Plan

`src/app/routes.tsx` is already large enough that new route work should prefer extraction over more in-place expansion.

Recommended next split:

- `src/app/routing/lazy-pages.ts` for `lazyNamedPage(...)` definitions
- `src/app/routing/guards.tsx` for route wrappers and shared route helpers
- `src/app/routing/routes.tsx` for the composed route tree only

Rules:

- do not add new feature-specific helper logic directly into the route tree if it can live beside the tree as data or a helper
- keep `handle.crumb` and route metadata stable; presentation belongs in layout/breadcrumb components
- when a new module adds multiple detail routes, group them as a route family instead of sprinkling them through unrelated blocks

Scan-first action panels and selector-driven create panels are packaged as route-local view components under the matching domain, for example `features/inbound/view/components/ScanReceivePanel.tsx` and `features/transfers/view/components/CreateTransferOrderPanel.tsx`.

## Current Domain Detail Routes

- Inventory is now a workbench route rather than a single balance screen. It groups inventory information, stock-count escalation, internal moves, stock-age reporting, manual adjustments, and cross-warehouse planning in one warehouse-scoped module page.
- Inbound purchase-order detail exposes editable header fields and a cancel action.
- Inbound queue now exposes an overdue-receipts exception lane ahead of the broader purchase-order queue. Standard stock-in list management also now has a dedicated status-tabbed filter card above a bounded data table, and its search/date state is mapped through a stock-in-specific filter model rather than the legacy generic toolbar fields.
- Outbound sales-order detail exposes editable header fields plus allocation/cancel actions.
- Outbound queue now exposes wave generation, scan-to-pack, scan-to-inspect, weighing-to-ship, shipping-document generation, logistics-tracking capture, a real short-pick exception lane backed by explicit backend short-pick records and resolution actions, plus dock-load verification and higher-level package-management tables.
- B2B exposes a cross-cut workbench for replenishment-style flows and now scopes every queue and supported mutation through the backend `order_type=B2B` partition. It still reuses the same inbound/outbound models underneath, but the partition is now enforced server-side rather than only by route semantics.
- Transfers expose transfer-order detail plus replenishment task actions.
- Returns expose return-order detail plus receipt/disposition posting panels.
- Counting approval detail exposes approve/reject actions with count-line context, and the parent counting route surfaces blocked-count exception lanes.
- Automation exposes schedule creation, queue monitoring, worker heartbeats, and alert review.
- Automation detail routes expose object-level inspection for scheduled tasks and background tasks.
- Integrations expose job/webhook/carrier booking creation plus execution actions from the same route, along with failed-integration exception lanes.
- Integration detail routes expose object-level inspection for jobs, webhooks, and carrier bookings.
- Finance now lands on the fees workbench, while finance invoice detail still exposes finalize and finance-review actions with invoice-line detail on the legacy invoice route.
- Statistics expose stock in/out, standard stock-in, stock-out throughput, warehouse analysis, staff performance, receiving, listing, picking, packing, after-sales, and direct-shipping views from one route-level workbench.
- Security exposes company membership provisioning, invite issuance, password-reset issuance, access audit review, staff directory management, role assignment, lock-state control, and a direct path to personal MFA management.
- Clients exposes route-backed lifecycle subpages instead of local bucket state. `/clients` redirects to `/clients/approved`, and each lifecycle queue (`pending-approval`, `approved`, `review-not-approved`, `deactivated`) is a first-class subpage with its own URL while reusing the same dense filters, icon-style row actions, and staged editor. The primary client table now leads with customer code above customer name, then groups customer information, contact person, finance, account setup, and time into fixed queue columns.
- Products exposes product master data plus selected-product management for distribution products, serial-number policy, packaging, and product marks.
- Logistics exposes provider/channel configuration, customer routing preferences, logistics rules, charging strategy, and logistics cost capture as a first-class routed module under the authenticated shell.
- Work orders expose type management plus ranked execution scheduling so managers can see which orders need to be fulfilled first.

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
