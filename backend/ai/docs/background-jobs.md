# Background Jobs

Warehouse workflows frequently require asynchronous processing (importing purchase orders, syncing ERP updates, sending notifications). Plan ahead for a Redis-backed job runner.

## Recommended Stack

- **Celery + Redis**: Mature ecosystem, good Django integration, supports scheduled tasks and retries.
- **Alternatives**: RQ or Dramatiq if requirements stay simple. Regardless, standardize on Redis for the broker to reuse infrastructure.

## Project Integration Steps

1. Add Celery app (e.g., `backend/dachong_wms/celery.py`) and initialize in `__init__.py`.
2. Configure broker URL via `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` (point to Redis or a SQL backend as needed).
3. Split task modules per Django app (e.g., `inventory/tasks.py`). Keep tasks thin; delegate logic to shared services.
4. Provide management commands or process supervisor configs for running `celery worker`, `celery beat`, etc.

## Task Design Guidelines

- Keep payloads small; reference DB IDs over large serialized blobs.
- Use retries with exponential backoff for network-bound tasks.
- Record task outcomes (success/failure timestamps) when they affect inventory or compliance.
- Emit structured logs containing task name, args, and correlation IDs for traceability.

## When to Use Jobs

- Import/export operations that would block HTTP requests.
- Notifications (email, SMS, webhooks) triggered by inventory events.
- Periodic reconciliation tasks (inventory snapshots, stale reservation cleanup).
- Long-running integration syncs (ERP, carrier APIs).

## Avoid Background Jobs For

- Simple CRUD operations that finish within normal request budgets.
- Inventory adjustments where synchronous confirmation is mandatory.

## Observability

- Surface Celery metrics (queue backlog, failure rate) in monitoring dashboards.
- Configure dead letter queues or alerts for repeated task failures.
