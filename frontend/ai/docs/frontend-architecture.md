# Frontend Architecture

The frontend is a Vite + React + TypeScript application under `frontend/src/`. It follows a consistent MVC-inspired feature architecture documented in `frontend/ai/docs/feature-architecture.md`. The browser owns routing and presentation; backend workflow rules stay in Django; feature controllers coordinate between the two.

The current product audit and UX gap list live in `frontend/ai/docs/wms-product-audit.md`. That document is the source of truth for missing warehouse workflows, backend dependencies, and shared frontend priorities.

## Current Stack

- **Tooling**: Vite 6, TypeScript, npm.
- **UI**: MUI 7 with a shared theme in `src/app/theme.ts`.
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
      scope-context.tsx
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

- Authentication is based on the backend's legacy login contract, not JWT. The SPA stores the returned `openid` and `user_id`, then sends them back as `TOKEN` and `OPERATOR` headers on each API request.
- The frontend resolves the logged-in operator profile through `/api/staff/{id}/` after login so route guards and navigation can use the real `staff_type`.
- React Query stays behind controller hooks; routed pages render controller state instead of owning fetch logic directly.
- Feature-local `model/` files own endpoint constants, payload mappers, shared feature types, and Zod validators.
- Feature-local `controller/` files own mutation orchestration, query invalidation, and feature coordination.
- Feature-local `view/` files own JSX, MUI layout, and presentational composition.
- Shared UI primitives such as `PageHeader`, `MetricCard`, `StatusChip`, and `ResourceTable` keep the first set of screens consistent while the product surface grows.
- Exception-first surfaces use shared `ExceptionLane` tables so overdue, blocked, and failed workflow queues keep the same visual contract across domains.
- Repeated selector-driven create flows use shared `FormAutocomplete`, `ReferenceAutocompleteField`, `FormSwitchField`, JSON helpers, and reference-option hooks under `src/shared/` instead of rebuilding those primitives per feature.
- Workspace and warehouse context are centralized through `src/app/scope-context.tsx`, which keeps page flows aligned on the currently selected tenant/company and warehouse scope.
- Repeated table filtering and saved views use shared modules (`useDataView`, `DataViewToolbar`, and `ResourceTable` with toolbar slots) instead of per-page one-off controls.
- Repeated branding usage goes through reusable modules: raw logo files live in `src/assets/logo/`, and the live UI consumes them through shared components such as `BrandLogo` and `AuthShell`.

## Current Screen Set

- `LoginPage`: backend login plus test-system bootstrap.
- `SignupPage`: self-serve manager-account creation using the backend signup endpoint.
- `MfaChallengePage`: second-step login challenge for TOTP or recovery-code verification.
- `MfaEnrollmentPage`: authenticated TOTP setup, verification, and recovery-code display.
- `SecurityPage`: tenant staff access management, role assignment, lock-state control, and MFA posture summary.
- `DashboardPage`: high-level operational summary.
- `InventoryBalancesPage`: tenant-scoped stock positions.
- `InboundPage`: purchase orders, receipts, putaway tasks, and scan-first receive/putaway actions.
- `PurchaseOrderDetailPage`: editable purchase-order header flow plus cancel action.
- `OutboundPage`: sales orders, pick tasks, shipments, and scan-first pick/ship actions.
- `SalesOrderDetailPage`: editable sales-order header flow plus allocation and cancel actions.
- `TransfersPage`: transfer orders, transfer lines, replenishment rules, and replenishment task completion.
- `TransferOrderDetailPage`: editable transfer-order header flow plus line completion.
- `ReturnsPage`: return orders, return receipts, return dispositions, and return-side mutation panels.
- `ReturnOrderDetailPage`: editable return-order header flow with line-level receipt/disposition progress.
- `CountingPage`: handheld assignments, next-task scanner completion, supervisor approval queue, and blocked-count exception lanes.
- `CountApprovalDetailPage`: supervisor approval decision screen with count-line context.
- `AutomationPage`: schedule creation, queue monitoring, worker health, alert evaluation, and task retry/run-now actions.
- `ScheduledTaskDetailPage`: schedule inspection with related background tasks and alerts.
- `BackgroundTaskDetailPage`: queue-task inspection with payload/result JSON and retry action.
- `IntegrationsPage`: integration job creation, webhook intake, carrier booking creation, execution monitoring, and failed-integration exception lanes.
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
- Shared modules such as `WorkspaceContextSwitcher`, `DataViewToolbar`, `useDataView(...)`, `SummaryCard`, `MutationCard`, `DocumentHeaderFields`, `FormAutocomplete`, `ReferenceAutocompleteField`, `FormSwitchField`, `useReferenceOptions(...)`, and `invalidateQueryGroups(...)` absorb repeated view and controller patterns instead of repeating them across order-detail screens.
- Brand palette, gradients, and shadows come from `src/app/brand.ts`, so auth screens, page headers, and the shell all stay aligned with the gold/copper/charcoal logo theme.
- Search-heavy lookup fields now use debounced, paginated reference hooks instead of assuming the first page of options is sufficient.
- Queue-heavy screens now use the same filter/saved-view pattern for inventory, inbound, outbound, and security.
- Queue-heavy screens now use the same filter/saved-view pattern for transfers, returns, counting, finance, automation, and integrations as well.
- Inbound and outbound now expose exception-first lanes for overdue receipts and short-pick follow-up proxies before operators drop into the deeper queues.
- Read-mostly domains such as dashboard and inventory use the same feature shape, with table components extracted into `view/*Table.tsx`.
- Tests are colocated with the controller or view layer they exercise.
- Test coverage now covers auth restore, route guards, first route/data rendering, scan-first mutation panels, remote selector behavior, and transfer/return/automation/integration detail routes through Vitest + Testing Library.

## Immediate Next Frontend Work

- Add richer finance workflows beyond invoice review, such as settlement/remittance and dispute handling screens.
- Replace synthetic company context and staff-only access management once dedicated company and user-provisioning APIs exist on the backend.
