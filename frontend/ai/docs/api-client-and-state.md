# API Client and State Management

The frontend talks to the Django backend through a single fetch wrapper in `frontend/src/lib/http.ts`.

## Authentication Model

The backend is not using a typical SPA bearer token flow. The current contract is:

1. `POST /api/login/` with `name` and `password`, or `POST /api/signup/` with `name`, `email`, `password1`, and `password2`
2. If the operator already has verified MFA, `/api/login/` returns a pending challenge instead of an authenticated tenant session
3. `POST /api/mfa/challenges/verify/` completes that challenge and returns:
   - `token` for the browser session
   - `company_id`
   - `company_name`
   - `membership_id`
   - `openid` for backend tenant scoping
   - `user_id`
4. Frontend stores the authenticated values in local storage as the active session
5. Every authenticated API request sends:
   - `TOKEN: <profile token>`
   - `OPERATOR: <user_id>`

The operator profile is then fetched from `/api/staff/{id}/` so the SPA knows the resolved `staff_type`.

## HTTP Layer

`frontend/src/lib/http.ts` is responsible for:

- prefixing requests with `VITE_API_BASE_URL`
- attaching `TOKEN` and `OPERATOR` headers
- preserving cookies with `credentials: include`
- parsing JSON, text, and blob responses
- throwing a typed `ApiClientError` on failure

## Server State

TanStack Query is configured in `frontend/src/lib/query-client.ts`.

Current shared hooks:

- `usePaginatedResource(...)`
- `useResource(...)`
- `useReferenceOptions(...)`-style hooks for warehouses, locations, inventory balances, sales orders, purchase orders, shipments, webhooks, and customer derivation
- `useDebouncedValue(...)` for search-backed inputs that should not fire on every keystroke

These hooks are now consumed inside feature controller hooks instead of directly inside most routed pages. The package boundary is:

- `model/api.ts`: raw endpoint functions and URL constants
- `controller/actions.ts`: imperative mutations built on top of `model/api.ts`
- `controller/use<Feature>Controller.ts`: React Query orchestration and invalidation rules
- `view/*`: render-only consumption of controller state

Mutation flows now invalidate the relevant domain query keys (`inbound`, `outbound`, `counting`, `dashboard`, `inventory`, `finance`) from the owning controller hooks instead of scattering invalidation logic across route pages.

Repeated invalidation logic is centralized through `frontend/src/shared/lib/query-invalidation.ts` so new domains can reuse the same controller-side pattern.

Selector-backed creation flows now depend on shared reference hooks in `frontend/src/shared/hooks/use-reference-options.ts`. The rule is:

- controllers own the mutation and invalidation
- shared hooks own cross-domain lookup fetching
- shared reference hooks own debounced search text and incremental page loading
- views compose lookup options with RHF inputs through `ReferenceAutocompleteField`

Views should not import `useResource(...)` or `usePaginatedResource(...)` directly. That is part of controller ownership.

## Workspace and Warehouse Context

- `frontend/src/app/scope-context.tsx` owns the current company membership and warehouse selection.
- `frontend/src/app/workspace-preferences.ts` owns membership-scoped workbench preferences and workspace-tab state.
- Company membership lists come from `/api/access/my-memberships/`, and membership switching uses `/api/access/my-memberships/{id}/activate/`.
- Warehouse lists come from `/api/warehouse/`, and the active warehouse is persisted per tenant in local storage.
- Controllers should read the active warehouse from the scope context and add `warehouse=<id>` to backend queries whenever the endpoint supports it.
- Company-admin browser-account provisioning comes from `/api/access/company-memberships/`.
- Invite issuance, password-reset issuance, audit review, queue-view persistence, workspace tabs, and workbench preferences now come from `/api/access/*` endpoints instead of synthetic local-only state.

## Searchable Reference Inputs

Large selector flows now use the shared remote reference pattern:

- `ReferenceAutocompleteField` wraps RHF + MUI autocomplete for lookup fields
- `useReferenceOptions(...)` hooks fetch paginated option lists through `useInfiniteQuery`
- search terms are debounced before hitting the backend
- the autocomplete loads additional pages on list scroll instead of assuming the first page is enough
- warehouses use explicit filter params; domains with DRF search support use `search=...`

## Reusable Queue Filters and Saved Views

- `useDataView(...)` owns:
  - page state
  - filter state
  - local saved views
- `useBulkSelection(...)` owns queue row selection state for batch-safe actions.
- `executeBulkAction(...)` runs repeated per-record mutations with aggregated success and failure reporting.
- `BulkActionBar` renders the shared selected-count and bulk-action affordance above queue tables.
- `DataViewToolbar` renders consistent queue controls:
  - filter inputs
  - active-filter counts
  - result counts
  - save/apply/delete view controls
- `ResourceTable` accepts the toolbar as a slot, so pages keep a stable structure while queue-specific filters change.
- `ExceptionLane` reuses the same table shell for watchlists such as overdue receipts, blocked counts, and failed integrations.
- Saved views are still local-browser only in the current controller layer, but the backend now exposes `QueueViewPreference` models so `useDataView(...)` can be upgraded to cross-device persistence next.
- Controllers should only expose bulk queue actions when the backend already exposes safe per-record endpoints. Where the backend lacks explicit bulk-safe primitives, the UI should document the gap instead of simulating unsupported state.

## API Base URL Strategy

- Development and production now both target `/api` from the browser-facing app.
- In development, the Vite server proxies `/api`, `/admin`, `/media`, and `/static` to Django using `VITE_DEV_PROXY_TARGET`.
- In production, the Nginx frontend container proxies those same paths to the backend container.
- `frontend/src/lib/http.ts` normalizes base/path joins so `VITE_API_BASE_URL=/api` does not duplicate the `/api` prefix already present in route constants.

## Session State

Browser auth state is stored in `frontend/src/shared/storage/auth-storage.ts` and exposed through `frontend/src/features/auth/controller/useAuthController.tsx`.

The auth provider currently owns:

- restoring a stored session on app load
- login
- pending MFA challenge storage and completion
- signup
- test-system bootstrap login
- logout

## Error Handling

`frontend/src/shared/utils/parse-api-error.ts` normalizes DRF and legacy FBMsg payloads into user-facing messages for alerts and form errors.

## Next API/State Work

- Extract repeated scan-mutation patterns into domain hooks once the scanner surface grows further.
- Invalidate related queries after create/update flows.
- Add download helpers for finance/counting export endpoints and settlement/remittance artifacts.
- Add optimistic state only where operator workflows need it.
- Add cross-device persistence for saved views if the backend exposes a settings/preferences surface.
- Add access-audit and invite/reset flows on top of the company-membership APIs.

## JF-Inspired State Requirements

To support the next JF-style surface area, shared state should account for more than auth and simple table filters.

Add or extend support for:

- workspace-tab state with per-tab route, filter, sort, pagination, and active-detail context
- column-visibility and density preferences per queue
- saved advanced filter presets per domain and per tenant when backend persistence becomes available
- status-bucket definitions that can be reused between dashboard cards, left-rail queue navigation, and exception lanes
- homepage/workbench widget preferences by role

Implementation rule:

- if a state shape is reused across modules, it belongs in shared app/controller infrastructure rather than page-local `useState` trees
- any future backend preference endpoints should persist queue views, column configs, and workbench layouts rather than inventing disconnected settings surfaces

The first backend-backed slice is now in place:

- `GET /api/access/workspace-tabs/`
- `POST /api/access/workspace-tabs/sync/`
- `POST /api/access/workspace-tabs/{id}/activate/`
- `DELETE /api/access/workspace-tabs/{id}/`
- `GET/PATCH /api/access/workbench-preferences/current/`
- `GET/POST/PATCH/DELETE /api/access/queue-view-preferences/`
