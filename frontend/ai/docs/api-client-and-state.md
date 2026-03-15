# API Client and State Management

The frontend talks to the Django backend through a single fetch wrapper in `frontend/src/lib/http.ts`.

## Authentication Model

The backend is not using a typical SPA bearer token flow. The current contract is:

1. `POST /api/login/` with `name` and `password`, or `POST /api/signup/` with `name`, `email`, `password1`, and `password2`
2. If the operator already has verified MFA, `/api/login/` returns a pending challenge instead of an authenticated tenant session
3. `POST /api/mfa/challenges/verify/` completes that challenge and returns `openid` and `user_id`
4. Frontend stores the authenticated values in local storage as the active session
5. Every authenticated API request sends:
   - `TOKEN: <openid>`
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

## Searchable Reference Inputs

Large selector flows now use the shared remote reference pattern:

- `ReferenceAutocompleteField` wraps RHF + MUI autocomplete for lookup fields
- `useReferenceOptions(...)` hooks fetch paginated option lists through `useInfiniteQuery`
- search terms are debounced before hitting the backend
- the autocomplete loads additional pages on list scroll instead of assuming the first page is enough
- warehouses use explicit filter params; domains with DRF search support use `search=...`

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
