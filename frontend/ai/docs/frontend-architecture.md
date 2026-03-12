# Frontend Architecture

The DaChongWMS frontend is a Vite-powered React application written in TypeScript. This guide captures the guiding principles before feature code lands.

## Stack

- **Tooling**: Vite for dev server/build, ESLint + Prettier for lint/format, Vitest or Jest for unit tests.
- **Language**: TypeScript with strict mode enabled.
- **UI Library**: MUI (Material UI) for theming and primitives.
- **State**: React Query or RTK Query for server state, React Context/Zustand for global UI state, component-local state for transient interactions.

## Folder Structure (proposed)

```
frontend/
  src/
    app/            # App shell, routing, theme provider
    features/
      inventory/
        components/
        hooks/
        api/
      ...
    shared/
      components/
      hooks/
      utils/
    lib/            # cross-cutting helpers (http client, config)
    assets/
    styles/
```

- Keep feature code co-located (components + hooks + API adapters).
- Shared utilities should be framework-agnostic (formatters, constants, permission helpers).

## Environment Management

- Use `.env` files consumed by Vite (prefix variables with `VITE_`). Example: `VITE_API_BASE_URL`.
- Document environment expectations in `frontend/.env.example` when the app materializes.

## Build Targets

- Development: `npm run dev` (Vite dev server with hot reload).
- Production: `npm run build` (outputs static assets under `dist/`). Serve via CDN or the backend’s static pipeline (WhiteNoise) if necessary.

## Quality Gates

- Enforce type-checking via `tsc --noEmit` in CI.
- Add lint and test steps to the pipeline before merge.
- Snapshot or visual regression testing is encouraged for data-dense screens.
