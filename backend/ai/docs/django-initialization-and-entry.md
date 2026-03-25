# Django Initialization and Entry

This document describes how Django boots inside DaChongWMS through the first-class `config` project.

## Core Files

- `backend/manage.py` — CLI entry used for `runserver`, migrations, and management commands. It now defaults `DJANGO_SETTINGS_MODULE` to `config.settings.dev`.
- `backend/config/asgi.py` — Canonical ASGI entrypoint for async servers.
- `backend/config/wsgi.py` — Canonical WSGI entrypoint for Gunicorn/uWSGI style deployments.
- `backend/config/settings/base.py` — Shared modular-backend settings.
- `backend/config/settings/dev.py` — Development profile.
- `backend/config/settings/prod.py` — Production profile.
- `backend/config/settings/test.py` — Test profile.
- `backend/apps/common/env.py` — Shared environment parsing helpers for all supported settings profiles.

## Initialization Flow

1. Environment variables are loaded by the shell, Docker, or orchestration layer.
2. The entry command executes:
   - `python backend/manage.py runserver`
   - `gunicorn config.wsgi:application`
   - `uvicorn config.asgi:application`
3. The entry module sets `DJANGO_SETTINGS_MODULE` if it is not already present.
4. Django imports the chosen `config.settings.*` module.
5. Django loads `config.urls`, initializes installed apps, and starts serving requests.

## Canonical runtime targets

- Development:
  - `DJANGO_SETTINGS_MODULE=config.settings.dev`
  - `python backend/manage.py runserver`
- Production:
  - `DJANGO_SETTINGS_MODULE=config.settings.prod`
  - `gunicorn config.wsgi:application`
- Tests:
  - `DJANGO_SETTINGS_MODULE=config.settings.test`
  - `python backend/manage.py test ... --settings=config.settings.test`
  - `TEST_DATABASE_URL` overrides the PostgreSQL database used for the Django test runner; otherwise it falls back to `DATABASE_URL`

## Docker alignment

- `backend/Dockerfile` now pre-collects static assets with `config.settings.prod`.
- `docker-compose.dev.yml` uses `config.settings.dev`.
- `docker-compose.prod.yml` runs `gunicorn config.wsgi:application` with `config.settings.prod`.

## Common Gotchas

- Do not introduce a second Django project package under `backend/`; keep project entrypoints in `backend/config/*`.
- Do not reintroduce a root-level `backend/utils`; shared modular helpers belong in `backend/apps/common/*`.
- When running the modular backend locally, prefer explicit settings overrides such as `--settings=config.settings.test` for tests and one-off commands.
- The supported backend database is PostgreSQL across dev, test, and prod settings.
