# DaChongWMS

Warehouse management system stack composed of a Django/DRF backend and Vite + React frontend.

## Documentation

Authoritative design notes live inside the repo so they version with code:

- `backend/ai/docs/` — backend-specific references:
  - `django-initialization-and-entry.md`: manage.py/ASGI/WSGI boot flow and deployment entrypoints.
  - `backend-architecture.md`: target layering (apps, services, API conventions).
  - `api-conventions.md`, `auth-and-permissions.md`: REST, auth, and RBAC expectations.
  - `models-and-migrations.md`: Postgres-first modeling approach and migration workflow.
  - `caching-and-redis.md`, `background-jobs.md`, `error-handling-and-logging.md`: infrastructure guidance for cache, async work, and observability.
- `frontend/ai/docs/` — frontend playbooks:
  - `frontend-architecture.md`: Vite/React/MUI stack overview and directory layout.
  - `routing-and-layout.md`: React Router patterns, layout shell, and navigation UX.
  - `api-client-and-state.md`: HTTP client, React Query usage, and state separation.
  - `mui-patterns.md`, `forms-and-validation.md`: theming, component composition, and form validation practices.

Consult these docs before adding new features; update them alongside behavior changes to keep context current. For higher-level coordination or knowledge sharing, mirror highlights to your project wiki pointing back to these canonical files.
