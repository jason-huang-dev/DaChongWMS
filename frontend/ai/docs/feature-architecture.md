# Feature Architecture

The frontend uses a consistent MVC+T feature structure. The chosen layout is lower-case `model/`, `controller/`, `view/`, and `test/` directories under each feature.

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
  view/
    <Feature>Page.tsx
    <Feature>Table.tsx
    <Feature>Form.tsx
    components/
      *.tsx
  test/
    <Feature>Page.test.tsx
    <Feature>Table.test.tsx
    <FeatureModel>.test.ts
    components/
      *.test.tsx
```

Not every feature needs every file. Read-only features can omit `Form.tsx`; mutation-free features can omit `actions.ts`; simple features can omit `components/`. The directory shape stays the same so developers know where new code belongs.

## Why This Structure

- It scales better than single-file `Model.ts` or `Controller.ts` layouts once a feature has multiple pages, tables, and scan flows.
- It keeps imports predictable without forcing large barrel files or root-level re-export shims.
- Lower-case directories avoid case-sensitivity drift between macOS and Linux.
- Tests stay under a feature-local `test/` tree so the architecture stays visibly MVC+T instead of mixing test files into `view/` or `controller/`.

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

## Shared Component Packaging

Reusable UI under `frontend/src/shared/components/` now follows a folder-per-component layout:

```text
frontend/src/shared/components/
  <component>/
    <component>.tsx
    <component>.test.tsx
    index.ts
```

Rules:

- `index.ts` should re-export the component so feature imports can stay at `@/shared/components/<component>`.
- Colocate component tests in the same folder as `<component>.test.tsx` when tests exist.
- If a presentational pattern is reused across features or is clearly becoming a shared primitive, extract it into `shared/components/<component>/` instead of duplicating JSX in feature `view/` trees.
- Do not leave new reusable UI as flat files directly under `shared/components/`.
- If a flat `shared/components/<component>.tsx` file exists, it should be a temporary compatibility re-export only and must not contain the real implementation.

## Enforcement Rules

- Do not add root-level feature shims like `features/auth/login-page.tsx`.
- Route modules must import from `features/<feature>/view/*`.
- Server mutations and query invalidation belong in controller hooks, not in views.
- API payload mapping belongs in `model/mappers.ts` or `model/api.ts`, not in JSX files.
- New tests should live under `features/<feature>/test/` and mirror the owning layer in filename and folder shape.
- If a legacy `*.test.tsx` file still lives under `view/`, `controller/`, or `model/`, move it into the feature `test/` tree when you touch that feature.

## Current Application

This structure is now applied across the active feature work. `clients` and `inventory` already use the dedicated `test/` layer, and the remaining features should be migrated when they are next touched.

## JF-Inspired Packaging Additions

Because the next phase is explicitly aligning to `frontend/ai/docs/jf-wms-reference.md`, feature packages should also be ready for denser queue-first screens.

Recommended optional view files for queue-heavy domains:

```text
frontend/src/features/<feature>/
  view/
    <Feature>WorkbenchPage.tsx
    <Feature>StatusNav.tsx
    <Feature>AdvancedFilters.tsx
    <Feature>Table.tsx
    <Feature>DetailPage.tsx
    components/
      WorkspaceTabTitle.tsx
      QueueSummaryCards.tsx
```

Additional guidance:

- `WorkbenchPage.tsx` should be used when a domain needs summary cards, notifications, help links, or queue shortcuts before the main table.
- `StatusNav.tsx` should package left-rail or top-rail queue state buckets with counts.
- `AdvancedFilters.tsx` should wrap domain-specific filter definitions on top of the shared queue primitives.
- Queue-specific configuration objects such as column registries, status-bucket definitions, and export mappings belong in `model/` or `controller/`, not inline in JSX.
- If workspace tabs are introduced, their persistence/orchestration belongs in shared app/controller layers, while tab titles and local route affordances stay in `view/`.
