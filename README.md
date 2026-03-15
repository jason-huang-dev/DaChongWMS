# DaChongWMS

Warehouse management system stack composed of a Django/DRF backend and Vite + React frontend.

## Documentation

Authoritative design notes live inside the repo so they version with code:

- `backend/ai/docs/` — backend-specific references:
  - `django-initialization-and-entry.md`: manage.py/ASGI/WSGI boot flow and deployment entrypoints.
  - `backend-architecture.md`: target layering (apps, services, API conventions).
  - `api-conventions.md`, `auth-and-permissions.md`: REST, auth, and RBAC expectations.
  - `models-and-migrations.md`: Postgres-first modeling approach and migration workflow.
  - `postgres13-to-16-migration.md`: explicit dump/restore workflow for the old PG13 Docker volume.
  - `caching-and-redis.md`, `background-jobs.md`, `error-handling-and-logging.md`: infrastructure guidance for cache, async work, and observability.
- `frontend/ai/docs/` — frontend playbooks:
  - `frontend-architecture.md`: Vite/React/MUI stack overview and directory layout.
  - `routing-and-layout.md`: React Router patterns, layout shell, and navigation UX.
  - `api-client-and-state.md`: HTTP client, React Query usage, and state separation.
  - `mui-patterns.md`, `forms-and-validation.md`: theming, component composition, and form validation practices.

Consult these docs before adding new features; update them alongside behavior changes to keep context current. For higher-level coordination or knowledge sharing, mirror highlights to your project wiki pointing back to these canonical files.

## Docker Environments

The stack now separates shared Compose state from development and production behavior:

- `docker-compose.yml` — shared service definitions
- `docker-compose.dev.yml` — bind mounts, Django `runserver`, Vite dev server, exposed Postgres
- `docker-compose.prod.yml` — Gunicorn backend, Nginx frontend, private Postgres
- shared Compose now runs PostgreSQL 16 because Django 5.2 does not support PostgreSQL 13

### Development

1. Copy `.env.dev.example` to `.env` if you do not already have a local dev env file.
2. Start the stack:

```bash
make dev
# or: make dev_build
```

The frontend runs on `http://localhost:5173` through Vite. `/api`, `/admin`, `/media`, and `/static` are proxied to the backend container.

### Production

1. Copy `.env.prod.example` to `.env.prod` and replace every placeholder secret/value.
2. Start the stack:

```bash
make prod PROD_ENV_FILE=.env.prod
# or: make prod_build PROD_ENV_FILE=.env.prod
```

The production frontend is built with `VITE_API_BASE_URL=/api` and Nginx proxies `/api`, `/admin`, `/media`, and `/static` to the Django/Gunicorn container.

If you still have a local PostgreSQL 13 compose volume from an older stack version, Docker will keep it around but the new stack will use the new `db_data_pg16` volume. Migrate data explicitly before pointing a real environment at PostgreSQL 16.

Explicit dump/restore helpers:

```bash
make export_pg13_dump OLD_PG13_VOLUME=dachongwms_db_data DUMP_FILE=tmp/pg13-to-pg16.dump
make import_pg13_dump DUMP_FILE=tmp/pg13-to-pg16.dump
```
