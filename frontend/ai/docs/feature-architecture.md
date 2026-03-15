# Feature Architecture

The frontend uses a consistent MVC-inspired feature structure. The chosen layout is lower-case `model/`, `controller/`, and `view/` directories under each feature.

## Chosen Structure

```text
frontend/src/features/<feature>/
  model/
    api.ts
    mappers.ts
    types.ts
    validators.ts
  controller/
    actions.ts
    use<Feature>Controller.ts
    *.test.ts(x)
  view/
    <Feature>Page.tsx
    <Feature>Table.tsx
    <Feature>Form.tsx
    components/
      *.tsx
      *.test.tsx
```

Not every feature needs every file. Read-only features can omit `Form.tsx`; mutation-free features can omit `actions.ts`; simple features can omit `components/`. The directory shape stays the same so developers know where new code belongs.

## Why This Structure

- It scales better than single-file `Model.ts` or `Controller.ts` layouts once a feature has multiple pages, tables, and scan flows.
- It keeps imports predictable without forcing large barrel files or root-level re-export shims.
- Lower-case directories avoid case-sensitivity drift between macOS and Linux.
- Tests can live next to the layer they verify instead of piling up at the feature root.

## Layer Responsibilities

### Model

`model/` owns domain knowledge and backend contracts.

- API clients and endpoint constants
- DTO and domain types
- mapper and transformation helpers
- validation schemas and normalization helpers

Model files must not import from `controller/` or `view/`.

### Controller

`controller/` owns orchestration.

- React Query hooks and invalidation rules
- event handlers and workflow coordination
- feature-level state transitions
- route-to-feature coordination

Controllers may import from `model/`, `shared/`, router hooks, and React state libraries. Controllers must not render JSX-heavy presentation.

### View

`view/` owns presentation.

- routed pages
- tables, forms, and cards
- MUI layout and display components
- feature-local presentational components

Views may import controller hooks, shared presentational components, and model types or validators when needed for form binding. Views must not call `apiGet`, `apiPost`, `apiPatch`, `useResource`, or `usePaginatedResource` directly.

## Dependency Rules

- `model -> shared/lib` is allowed
- `controller -> model/shared/router` is allowed
- `view -> controller/shared` is preferred
- `view -> model` is allowed for type-only imports and validation helpers
- `model -> controller/view` is forbidden
- `controller -> view` is forbidden

## Enforcement Rules

- Do not add root-level feature shims like `features/auth/login-page.tsx`.
- Route modules must import from `features/<feature>/view/*`.
- Server mutations and query invalidation belong in controller hooks, not in views.
- API payload mapping belongs in `model/mappers.ts` or `model/api.ts`, not in JSX files.
- New tests should be colocated with the owning controller or view file.

## Current Application

This structure is now applied across `auth`, `dashboard`, `inventory`, `inbound`, `outbound`, `transfers`, `returns`, `counting`, `automation`, `integrations`, `reporting`, and `security`.
