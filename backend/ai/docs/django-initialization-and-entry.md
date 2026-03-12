# Django Initialization and Entry

This document explains how Django boots inside DaChongWMS and how each entrypoint should be used for development, staging, and production.

## Core Files

- `backend/manage.py` — CLI entry used for `runserver`, management commands, migrations, etc. It sets `DJANGO_SETTINGS_MODULE` to `dachong_wms.settings` before delegating to Django.
- `backend/dachong_wms/asgi.py` — Async entrypoint for ASGI servers such as Uvicorn, Daphne, or Hypercorn. It exposes the `application` callable discovered by the ASGI server.
- `backend/dachong_wms/wsgi.py` — Sync entrypoint for WSGI servers such as Gunicorn or uWSGI. Use when ASGI features (websockets, long-lived async tasks) are not required.
- `backend/dachong_wms/settings.py` — Centralized configuration consumed by both entrypoints. All process types share the same settings module so environment-managed overrides are critical.

## Initialization Flow

1. **Environment variables** are sourced via shell, `.env`, or orchestration layer. Key variables:
   - `DJANGO_SECRET_KEY`
   - `DJANGO_DEBUG`
   - `DJANGO_ALLOWED_HOSTS`
   - `DJANGO_CORS_ALLOWED_ORIGINS`, `DJANGO_CSRF_TRUSTED_ORIGINS`
   - Database and cache URLs as the stack evolves (see other docs).
2. **Entry command executes** (`python manage.py runserver`, `uvicorn dachong_wms.asgi:application`, etc.).
3. **Entry module** (`manage.py`, `asgi.py`, or `wsgi.py`) sets `DJANGO_SETTINGS_MODULE` if missing.
4. **Django loads settings** and performs app registry initialization.
5. **Runtime server** (runserver, Gunicorn worker, etc.) serves requests through the configured middleware stack.

## Local Development

- Default DB is SQLite via `dj_database_url`, but developers may point to Postgres by exporting `DATABASE_URL`.
- Use `python manage.py runserver` for quick iteration. This uses the same settings module so features such as DRF, CORS, and static handling follow production paths.
- Keep `.env` files scoped per developer; do not commit secrets.

## Deployment Targets

- **ASGI (preferred long-term)**: Allows websocket channels, async views, and compatibility with async task dispatch. Example command: `uvicorn dachong_wms.asgi:application --host 0.0.0.0 --port 8000`.
- **WSGI**: Works with established Django hosting stacks. Example command: `gunicorn dachong_wms.wsgi:application`.
- **Management jobs**: Use `python manage.py <command>` inside the same virtualenv/container image used for serving.

## Shared Utilities

- Token auth + throttles from `backend/utils` are wired via `REST_FRAMEWORK` settings, so new apps automatically inherit the header-based authentication, rate limits, and custom exception handler.
- Validation helpers (`datasolve.py`) and support modules (`fbmsg.py`, `md5.py`, `jwt.py`, `websocket.py`) live under the same package; import them instead of duplicating logic when building future domain models or APIs.

## Health Checks & Observability

- Add lightweight health endpoints under `/api/health/` within a future `ops` app; use DRF permissions to restrict as needed.
- Tie log output to the `LOGGING` dict in `settings.py`. When running under Gunicorn/Uvicorn, ensure access logs are forwarded to the same sink as Django logs.

## Common Gotchas

- Always activate the virtualenv before running manage.py so all requirements (CORS, DRF, Spectacular) are available.
- If `DJANGO_SETTINGS_MODULE` is overridden for experiments, remember to revert to `dachong_wms.settings` before committing anything.
- Keep ASGI and WSGI modules minimal—initialization logic should live in settings, apps, or dedicated service modules.
