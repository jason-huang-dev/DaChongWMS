# Backend Architecture

DaChongWMS uses Django and Django REST Framework (DRF) to deliver a modular, domain-first backend. This document captures the layered approach so future apps align with the same structure.

## High-Level Layers

1. **Entry + Configuration**: `dachong_wms.settings`, `asgi.py`, and `wsgi.py`. Responsible for bootstrapping the project, registering apps, and configuring middleware.
2. **Django Apps**: Each domain (inventory, inbound, outbound, users, etc.) lives in its own Django app inside `backend/`. Apps should isolate models, serializers, services, and API modules.
3. **Service Layer**: When request logic grows beyond CRUD, move it to plain Python modules (e.g., `inventory/services/adjustments.py`) so reuse across views, signals, and tasks stays easy.
4. **API Layer**: DRF viewsets/routers per app. Shared pagination, filtering, and schema generation stay centralized via project-level DRF settings.
5. **Infra Integrations**: Database (Postgres), Redis cache, background queue (to be defined). All configuration lives in settings with environment-driven overrides.
6. **Utility Layer**: Shared helpers imported from `backend/dachong_wms/utils/` (validators, authentication, throttling, websocket relays, fbmsg catalog). These provide compatibility with GreaterWMS modules and keep multi-tenant concerns centralized.
7. **Onboarding Services**: `userregister` exposes `/api/register/` for developer sign-up. It writes to `userprofile.Users` and seeds demo data when optional apps (company, warehouse, staff) are installed.

## Current State

- Only the core project scaffolding exists (`backend/dachong_wms`). New domain apps should be added to `LOCAL_APPS` in settings.
- DRF Spectacular is wired for schema and docs under `/api/schema/` and `/api/docs/`.
- CORS, CSRF, WhiteNoise, and DRF defaults are preconfigured for typical deployments.

## App Layout Template

```
backend/
  <app_name>/
    __init__.py
    apps.py
    models.py (split into modules when large)
    serializers/
    services/
    views.py or views/
    urls.py (registered via project router)
    permissions.py
    tests/
```

- Keep migrations inside each app.
- Prefer `routers.DefaultRouter` for registering viewsets.
- Store fixtures or seeds per app under `fixtures/`.

## Cross-Cutting Concerns

- **Authentication**: Base on Django auth; extend with custom user model early if required.
- **Auditing**: Track user + timestamp for inventory mutations.
- **Validation**: Centralize advanced checks in services or validators; keep serializers slim.
- **Transactions**: Wrap mutating flows with `transaction.atomic()` especially when touching stock.

## Future Enhancements

- Introduce a shared “core” app for reusable mixins (timestamp models, base viewsets, querysets).
- Add health and metrics endpoints under an `ops` app.
- Extract environment variable parsing helpers to `settings_utils.py` if the module grows too large.
