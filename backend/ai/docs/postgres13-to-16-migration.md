# PostgreSQL 13 to 16 Migration

The dev stack now runs PostgreSQL 16 because Django 5.2 no longer supports PostgreSQL 13.

## Goal

Move data explicitly from the old Docker volume (`dachongwms_db_data`) into the new PostgreSQL 16 volume (`dachongwms_db_data_pg16`) instead of silently reusing an unsupported database.

## Export the Old Volume

```bash
make export_pg13_dump OLD_PG13_VOLUME=dachongwms_db_data DUMP_FILE=tmp/pg13-to-pg16.dump
```

What this does:

- starts a temporary `postgres:13` container against the old named volume
- waits for it to accept connections
- exports the configured application database into `tmp/pg13-to-pg16.dump`

## Import into the PostgreSQL 16 Dev Database

```bash
make import_pg13_dump DUMP_FILE=tmp/pg13-to-pg16.dump
```

What this does:

- starts the current dev `db` service if needed
- drops and recreates the configured application database inside PostgreSQL 16
- restores the exported dump into the new database

## Important Constraints

- `import_pg13_dump` is destructive for the current dev database because it recreates the target database before restoring the dump.
- The script assumes the old volume used the same `POSTGRES_DB`, `POSTGRES_USER`, and `POSTGRES_PASSWORD` values as the current stack. Override those environment variables if your old volume used different credentials.
- Do not treat the PostgreSQL 16 volume as canonical production data until you have completed an explicit export/import and smoke-tested the restored stack.
