# Models and Migrations

Reliable inventory data requires disciplined modeling and migration practices.

## Database Targets

- **Default development DB**: PostgreSQL.
- **Default Docker development DB**: PostgreSQL from `docker-compose.dev.yml`.
- **Primary production DB**: PostgreSQL. Configure via `DATABASE_URL` env var.
- **Automated test DB**: PostgreSQL as well. `config.settings.test` reads `TEST_DATABASE_URL` first and falls back to `DATABASE_URL`.
- Future replicas or analytics DBs should be documented separately.

## Modeling Guidelines

1. **Explicit Entities**: Model inventory balances, movement history, holds, warehouses, locations, orders, receipts, adjustments, and user roles separately.
2. **Timestamps & Audit Fields**: Include `created_at`, `updated_at`, and user references on records that affect stock or compliance.
3. **Foreign Keys**: Always set `on_delete` behavior intentionally (`PROTECT` for critical references like warehouses, `CASCADE` where safe).
4. **Constraints**: Use `UniqueConstraint`, `CheckConstraint`, and partial indexes to preserve invariants (e.g., SKU per warehouse uniqueness).
5. **Managers/QuerySets**: Encapsulate query logic (e.g., `InventoryItem.available()`) so views remain thin.
6. **Global Auth User**: `apps.accounts.User` is the Django auth user model. Do not change `AUTH_USER_MODEL` on an already-migrated shared database without planning a reset or data migration.
7. **Operator Preferences**: Queue-view presets, workspace tabs, and workbench layouts should be explicit models with membership ownership instead of anonymous browser-only blobs once the frontend starts behaving like a multi-tab operator console.

## Migrations Workflow

- Use `python manage.py makemigrations <app>` after schema changes; review generated files before committing.
- Enforce linear, per-app migrations. Avoid squashing until the schema stabilizes.
- Never edit committed migrations unless coordinating a repo-wide reset.
- For destructive changes (dropping columns, tables), add transitional migrations (add new field, backfill, swap, remove old) to prevent downtime.
- If you switch `AUTH_USER_MODEL` or otherwise replace foundational auth tables in development, do not fake around inconsistent history. Reset the PostgreSQL dev schema and remigrate instead:
  - `make remigrate` for the Docker dev database
  - or recreate your local PostgreSQL development database/schema and rerun `python backend/manage.py migrate --settings=config.settings.dev`

## Seeds & Fixtures

- Store lightweight fixtures under `<app>/fixtures/`. Use them for local dev or unit tests, not as a replacement for migrations.
- Prefer custom management commands for large seed operations to keep logic versioned.

## Testing

- Write model tests covering constraints, managers, and critical state transitions.
- When validating inventory math, assert both database state and emitted domain events/log entries.
