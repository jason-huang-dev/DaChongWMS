# Frontend Architecture

The frontend is a Vite + React + TypeScript application under `frontend/src/`. It follows a consistent MVC-inspired feature architecture documented in `frontend/ai/docs/feature-architecture.md`. The browser owns routing and presentation; backend workflow rules stay in Django; feature controllers coordinate between the two.

The current product audit and UX gap list live in `frontend/ai/docs/wms-product-audit.md`. That document is the source of truth for missing warehouse workflows, backend dependencies, and shared frontend priorities.

The external reference model for the next implementation phase lives in `frontend/ai/docs/jf-wms-reference.md`. Codex should use it to emulate the functional posture of JF WMS — dense operator workbenches, broad domain navigation, advanced queue filters, status-bucket navigation, and strong bulk-action tooling — while still following our own architecture and branding.

## Current Stack

- **Tooling**: Vite 6, TypeScript, npm.
- **UI**: MUI 7 with a shared theme in `src/app/theme.ts`.
- **Localization**: root UI preferences and translation helpers in `src/app/ui-preferences.tsx` + `src/app/i18n.ts` with `en` and `zh-CN`.
- **Branding**: shared DaChong logo assets under `src/assets/logo/` plus reusable brand tokens in `src/app/brand.ts`.
- **Routing**: React Router with route-level auth and role guards.
- **Server state**: TanStack Query.
- **Forms**: React Hook Form + Zod.

## Application Folder Structure

```text
frontend/
  src/
    app/
      brand.ts
      i18n.ts
      scope-context.tsx
      ui-preferences-storage.ts
      ui-preferences.tsx
      layout/
      App.tsx
      providers.tsx
      routes.tsx
      theme.ts
    assets/
      logo/
    features/
      <feature>/
        model/
          api.ts
          mappers.ts
          types.ts
          validators.ts
        controller/
          actions.ts
          use<Feature>Controller.ts
        view/
          <Feature>Page.tsx
          <Feature>Table.tsx
          <Feature>Form.tsx
          components/
        test/
          *.test.ts(x)
    lib/
      config.ts
      http.ts
      query-client.ts
    shared/
      components/
      hooks/
      storage/
      types/
      utils/
```

Feature roots no longer contain compatibility shims. Imports should target the owning layer directly.

## Architectural Decisions

- Authentication is based on the backend's legacy login contract, not JWT. The SPA stores the returned profile token, active company membership, and `user_id`, then sends them back as `TOKEN` and `OPERATOR` headers on each API request.
- The frontend resolves the logged-in operator profile through `/api/staff/{id}/` after login so route guards and navigation can use the real `staff_type`.
- React Query stays behind controller hooks; routed pages render controller state instead of owning fetch logic directly.
- Feature-local `model/` files own endpoint constants, payload mappers, shared feature types, and Zod validators.
- Feature-local `controller/` files own mutation orchestration, query invalidation, and feature coordination.
- Feature-local `view/` files own JSX, MUI layout, and presentational composition.
- Feature-local `test/` files mirror the feature tree so the package reads as MVC+T rather than interleaving tests with `view/` or `controller/`.
- Shared UI primitives such as `PageHeader`, `MetricCard`, `StatusChip`, `ResourceTable`, the inventory-style `DataTable`, and dense queue chrome (`FilterCard`, `PageTabs`, and `ActionIconButton`) keep the first set of screens consistent while the product surface grows.
- Shared components now live in folder modules under `src/shared/components/<component>/`, with `<component>.tsx`, colocated `<component>.test.tsx` when applicable, and `index.ts` re-exports so reusable UI stays organized as the shared layer grows.
- Exception-first surfaces use shared `ExceptionLane` tables so overdue, blocked, and failed workflow queues keep the same visual contract across domains.
- Shared bulk queue actions use `useBulkSelection`, `BulkActionBar`, and `executeBulkAction` so selection state, batch orchestration, and operator feedback stay consistent across features.
- Repeated selector-driven create flows use shared `FormAutocomplete`, `ReferenceAutocompleteField`, `FormSwitchField`, JSON helpers, and reference-option hooks under `src/shared/` instead of rebuilding those primitives per feature.
- Workspace and warehouse context are centralized through `src/app/scope-context.tsx`, which keeps page flows aligned on the currently selected company membership and warehouse scope.
- UI locale and color mode are centralized through `src/app/ui-preferences.tsx`; the root provider persists browser preferences and rebuilds the MUI theme for light, dark, English, and Simplified Chinese modes.
- Repeated table filtering and saved views use shared modules (`useDataView`, `DataViewToolbar`, `ResourceTable`, and the denser inventory-style `DataTable`) instead of per-page one-off controls.
- Repeated branding usage goes through reusable modules: raw logo files live in `src/assets/logo/`, and the live UI consumes them through shared components such as `BrandLogo` and `AuthShell`.
- JF-style shell state now lives in shared app modules: `src/app/workspace-preferences.ts` owns workspace-tab and workbench-preference queries, while `app/layout/*` owns the horizontal module nav and workspace-tab strip.

## Current Screen Set

- `LoginPage`: backend login plus test-system bootstrap.
- `SignupPage`: self-serve manager-account creation using the backend signup endpoint.
- `MfaChallengePage`: second-step login challenge for TOTP or recovery-code verification.
- `MfaEnrollmentPage`: authenticated TOTP setup, verification, and recovery-code display.
- `SecurityPage`: tenant staff access management, role assignment, lock-state control, and MFA posture summary.
- `SecurityPage`: company membership provisioning, browser-account management, staff directory controls, role assignment, lock-state control, and MFA posture summary.
- `ClientsPage`: client-account queue pages under `/clients/*` with route-backed lifecycle subpages, dense filters, bulk export/activation controls, a dense table grouped by customer code/name, customer information, contact person, finance, setup, and time, plus a sticky icon-style operations rail and a dialog-based editor for portal and warehouse readiness.
- `ProductsPage`: product master data plus selected-product subworkflows for distribution products, serial settings, packaging, and product marks.
- `DashboardPage`: workbench-style operational summary with persisted time window and right-rail widgets.
- `InventoryBalancesPage`: inventory workbench covering tenant-scoped stock positions, count escalation, internal moves, stock-age reporting, manual adjustments, and cross-warehouse planning.
- `InboundPage`: stock-in workbench covering standard receipt posting, stock-in list management, scan sign/receive/list actions, CSV import intake, returns-to-stock visibility, and inbound record queues for ASN, signing, receiving, and listing.
- `PurchaseOrderDetailPage`: editable purchase-order header flow plus cancel action.
- `OutboundPage`: sales orders, pick tasks, shipments, dock-load verification, explicit short-pick follow-up, and scan-first pick/ship actions.
- `SalesOrderDetailPage`: editable sales-order header flow plus allocation and cancel actions.
- `TransfersPage`: transfer orders, transfer lines, replenishment rules, replenishment task completion, and bulk transfer archiving.
- `TransferOrderDetailPage`: editable transfer-order header flow plus line completion.
- `ReturnsPage`: return orders, return receipts, return dispositions, and return-side mutation panels.
- `ReturnOrderDetailPage`: editable return-order header flow with line-level receipt/disposition progress.
- `CountingPage`: handheld assignments, next-task scanner completion, supervisor approval queue, blocked-count exception lanes, and bulk approval decisions.
- `CountApprovalDetailPage`: supervisor approval decision screen with count-line context.
- `AutomationPage`: schedule creation, queue monitoring, worker health, alert evaluation, row-level task retry/run-now actions, and bulk schedule run-now actions.
- `ScheduledTaskDetailPage`: schedule inspection with related background tasks and alerts.
- `BackgroundTaskDetailPage`: queue-task inspection with payload/result JSON and retry action.
- `IntegrationsPage`: integration job creation, webhook intake, carrier booking creation, execution monitoring, failed-integration exception lanes, bulk job/webhook recovery actions, and carrier retry/rebook recovery.
- `IntegrationJobDetailPage`: job state, request/response payloads, and job-scoped logs.
- `WebhookEventDetailPage`: webhook state, headers/payload inspection, and webhook-scoped logs.
- `CarrierBookingDetailPage`: carrier booking state, linked jobs, and label payload inspection.
- `FinancePage`: invoices, settlements, disputes, finance exports.
- `InvoiceDetailPage`: invoice header, finance state, invoice lines, and finance-review actions.

## Delivery Pattern

- Route bundles are lazy-loaded in `src/app/routes.tsx` so the login and shell do not pull every screen into the first JS payload.
- Feature routes import directly from `features/<domain>/view/*`.
- Scan-first mutations and detail actions are split into `model/`, `controller/`, and `view/` layers for inbound, outbound, counting, reporting, auth, and MFA.
- Shared modules such as `SummaryCard`, `MutationCard`, `DocumentHeaderFields`, `FormAutocomplete`, `ReferenceAutocompleteField`, `FormSwitchField`, `useReferenceOptions(...)`, and `invalidateQueryGroups(...)` absorb repeated view and controller patterns instead of repeating them across order-detail screens.
- Shared modules such as `WorkspaceContextSwitcher`, `DataViewToolbar`, `DataTable`, `useDataView(...)`, `SummaryCard`, `MutationCard`, `DocumentHeaderFields`, `FormAutocomplete`, `ReferenceAutocompleteField`, `FormSwitchField`, `useReferenceOptions(...)`, and `invalidateQueryGroups(...)` absorb repeated view and controller patterns instead of repeating them across order-detail screens.
- Brand palette, gradients, and shadows come from `src/app/brand.ts`, so auth screens, page headers, and the shell all stay aligned with the gold/copper/charcoal logo theme.
- Shared UI primitives translate known shell/auth/common copy through `src/app/i18n.ts` so locale coverage can expand incrementally without rewriting every feature page at once.
- The authenticated shell is now JF-inspired: horizontal module nav first, workspace-tab strip second, content canvas third. Mobile keeps a drawer fallback.
- Search-heavy lookup fields now use debounced, paginated reference hooks instead of assuming the first page of options is sufficient.
- Queue-heavy screens now use the same filter/saved-view pattern across inventory, inbound, outbound, transfers, returns, counting, finance, automation, integrations, and security.
- `DataViewToolbar` now acts as a denser enterprise filter band, and queue pages can layer `StatusBucketNav` above it for state-first navigation.
- Queue-heavy screens now reuse the same row-selection and bulk-action contract where backend endpoints support batch-safe orchestration.
- Inbound and outbound now expose exception-first lanes for overdue receipts and explicit short-pick records before operators drop into the deeper queues.
- Read-mostly domains such as dashboard and inventory use the same feature shape, with table components extracted into `view/*Table.tsx`.
- Tests now belong under the owning feature's `test/` directory. Legacy colocated tests are being moved during normal feature work.
- Test coverage now covers auth restore, route guards, first route/data rendering, scan-first mutation panels, remote selector behavior, and transfer/return/automation/integration detail routes through Vitest + Testing Library.

## Immediate Next Frontend Work

- Continue extracting repeated UI into `shared/components/<component>/` modules instead of leaving reusable JSX inside feature `view/` trees.
- Add richer finance workflows beyond invoice review, such as settlement/remittance and dispute handling screens.
- Hook the new backend queue-view preference APIs into `useDataView(...)` so saved views become cross-device instead of browser-local.
- Extend status-bucket navigation beyond outbound into inbound, returns, and finance.
- Add true right-rail widgets and configurable workbench cards for more domains than dashboard.

## JF WMS Alignment

The next iteration target is no longer just “generic WMS screens.” It is a multi-tenant operator console that can stand beside JF-style WMS products. That means:

- workbench-style homepage and module landing pages
- queue-first domain pages with dense advanced filters
- broad first-class modules across warehouse, logistics, billing, and reporting
- status-driven secondary navigation with counts
- export, batch actions, and column customization as shared table capabilities
- optional multi-tab workspace behavior for power users

Any new feature that touches queue-heavy operations should check `jf-wms-reference.md` before inventing a thinner interaction model.
