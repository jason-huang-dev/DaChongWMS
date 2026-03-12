# API Client and State Management

Reliable API integration keeps the UI aligned with Django/DRF responses.

## HTTP Layer

- Wrap `fetch` or `axios` in a centralized client under `src/lib/http.ts`.
- Inject `VITE_API_BASE_URL`, auth tokens, and common headers (e.g., `Accept: application/json`).
- Handle 401/403 responses globally by redirecting to login or surfacing permission modals.

## Server State

- Use React Query (TanStack Query) for caching, retries, and background refresh.
- Define hooks per resource (`useInventoryItems()`, `useWarehouse(id)`) under `features/<domain>/api/`.
- Configure sensible defaults: stale time for reference data, refetch on focus for volatile endpoints.

## Local/UI State

- Component state for form inputs and UI toggles.
- Context or lightweight stores (Zustand, Jotai) for cross-page UI state like selected warehouse or scanning mode.

## Data Transformations

- Normalize API responses before hitting components to decouple from backend changes.
- Map enums/status codes to presentation models (colors, chip labels) in one place.

## Error Handling

- Convert DRF error payloads into human-readable messages using a shared helper (`parseApiError`).
- Surface toast/snackbar notifications via a central provider; avoid inline alerts scattered throughout components.

## Testing

- Mock API layer in unit tests with MSW (Mock Service Worker) to simulate backend responses.
- Write integration tests for critical workflows (receiving, picking) that cover query/mutation hooks end-to-end.
