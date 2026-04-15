# Frontend Change Quality

This document defines the minimum bar for frontend changes. The goal is to prevent fast local fixes from turning into long-lived architectural debt.

## Core Rule

**A change is incomplete if it only fixes the symptom in one screen while leaving the underlying pattern inconsistent.**

Before shipping a change, check whether the work should instead become:

- a model-layer helper
- a shared component
- a shared utility
- a controller-level workflow helper
- a catalog/message-group addition
- a documented architecture rule

## Required Change Checklist

Every non-trivial edit should answer these questions:

1. Is the logic in the right layer?
   Model logic belongs in `model/`, orchestration belongs in `controller/`, and JSX-only concerns belong in `view/`.
2. Did the change remove duplication instead of adding another copy?
   If similar logic already exists, extend or extract it rather than cloning it.
3. Did the change preserve existing patterns?
   Use existing shared table, filter, export, and translation primitives before inventing page-local ones.
4. Is the API of the new helper reusable?
   Avoid helpers that only work for one call site unless the problem is truly one-off.
5. Is the behavior covered?
   Add or update focused tests for calculation helpers, reusable utilities, route behavior, or rendering contracts.
6. Is the rule documented when it changes how future code should be written?
   Architecture-impacting changes should leave behind a short rule in the relevant doc.

## Anti-Patterns

These are the most common bandaid patterns and should be treated as defects:

- calculation logic embedded directly in JSX files when the data is domain logic
- duplicate CSV export, date formatting, or mapping helpers across features
- page-local copies of filter bands, summary strips, or table cell renderers that should be shared
- adding new localization keys ad hoc in `src/app/i18n.ts` without grouping or documenting the pattern
- making `src/app/routes.tsx` or `src/app/i18n.ts` larger without introducing a clearer composition boundary
- fixing a warning with a one-line patch while leaving the unstable data/key model in place

## Review Heuristics

When touching an existing area, prefer one of these upgrades:

- extract a shared utility if the pattern appears in multiple features
- move data derivation from `view/` into `model/`
- move orchestration from `view/` into `controller/`
- convert large inline configuration blocks into named builders or registries
- replace hardcoded values with theme, catalog, or model-driven configuration

## `src/app` Growth Policy

`src/app` currently works, but it should not continue growing as a flat set of large files.

Preferred steady-state structure:

```text
src/app/
  bootstrap/
    App.tsx
  providers/
    app-providers.tsx
  routing/
    routes.tsx
    lazy-pages.ts
    guards.tsx
  layout/
    ...
  i18n/
    index.ts
    catalog.ts
    message-groups/
  theme/
    index.ts
    brand.ts
  preferences/
    ui-preferences.tsx
    ui-preferences-storage.ts
    workspace-preferences.ts
  scope/
    scope-context.tsx
```

That structure does not need to be migrated in one sweep. It should happen opportunistically when the owning module is already being changed for product work.
