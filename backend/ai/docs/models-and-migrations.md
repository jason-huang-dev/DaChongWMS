# Models and Migrations

Reliable inventory data requires disciplined modeling and migration practices.

## Database Targets

- **Default development DB**: SQLite via `dj_database_url` (see `settings.DATABASES`).
- **Primary production DB**: PostgreSQL. Configure via `DATABASE_URL` env var.
- Future replicas or analytics DBs should be documented separately.

## Modeling Guidelines

1. **Explicit Entities**: Model inventory, warehouses, locations, stock movements, orders, receipts, adjustments, and user roles separately.
2. **Timestamps & Audit Fields**: Include `created_at`, `updated_at`, and user references on records that affect stock or compliance.
3. **Foreign Keys**: Always set `on_delete` behavior intentionally (`PROTECT` for critical references like warehouses, `CASCADE` where safe).
4. **Constraints**: Use `UniqueConstraint`, `CheckConstraint`, and partial indexes to preserve invariants (e.g., SKU per warehouse uniqueness).
5. **Managers/QuerySets**: Encapsulate query logic (e.g., `InventoryItem.available()`) so views remain thin.
6. **Tenant Accounts**: The `userprofile` app now holds the `Users` model (openid/appid pairs) used by header-token authentication, so treat it as the canonical source for tenant scoping until a fuller IAM story is built.

## Migrations Workflow

- Use `python manage.py makemigrations <app>` after schema changes; review generated files before committing.
- Enforce linear, per-app migrations. Avoid squashing until the schema stabilizes.
- Never edit committed migrations unless coordinating a repo-wide reset.
- For destructive changes (dropping columns, tables), add transitional migrations (add new field, backfill, swap, remove old) to prevent downtime.

## Seeds & Fixtures

- Store lightweight fixtures under `<app>/fixtures/`. Use them for local dev or unit tests, not as a replacement for migrations.
- Prefer custom management commands for large seed operations to keep logic versioned.

## Testing

- Write model tests covering constraints, managers, and critical state transitions.
- When validating inventory math, assert both database state and emitted domain events/log entries.
