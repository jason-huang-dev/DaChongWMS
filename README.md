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
  - `feature-architecture.md`: MVC+T feature layout and test-placement rules.
  - `frontend-architecture.md`: Vite/React/MUI stack overview and directory layout.
  - `routing-and-layout.md`: React Router patterns, layout shell, and navigation UX.
  - `api-client-and-state.md`: HTTP client, React Query usage, and state separation.
  - `mui-patterns.md`, `forms-and-validation.md`: theming, component composition, and form validation practices.

Consult these docs before adding new features; update them alongside behavior changes to keep context current. For higher-level coordination or knowledge sharing, mirror highlights to your project wiki pointing back to these canonical files.

## CI/CD

GitHub Actions now validates the repo and deploys both Vercel projects from a single workflow:

- workflow file: `.github/workflows/ci-cd.yml`
- frontend deploy target: Vercel project rooted at `frontend/`
- backend deploy target: Vercel project rooted at `backend/`

### Requirements

Before the workflow can deploy successfully, configure the following in GitHub and Vercel:

- GitHub Actions must be enabled for the repository.
- Create two Vercel projects from this monorepo:
  - frontend project with root directory `frontend`
  - backend project with root directory `backend`
- Add these GitHub repository secrets:
  - `VERCEL_TOKEN`
  - `VERCEL_ORG_ID`
  - `VERCEL_FRONTEND_PROJECT_ID`
  - `VERCEL_BACKEND_PROJECT_ID`
- Configure the required runtime environment variables directly in each Vercel project. See `Vercel-Supabase.md` for the expected frontend/backend hosting shape and environment setup.

### How The Workflow Works

The workflow has four jobs:

- `frontend_ci`
  - runs on pull requests, pushes to `main`, and manual dispatches
  - installs frontend dependencies with `npm ci`
  - runs `npm run test:ci`
  - runs `npm run build`
- `backend_ci`
  - installs backend dependencies from `backend/requirements.txt`
  - runs backend tests with `TEST_DATABASE_URL=sqlite:////tmp/dachongwms-test.sqlite3`
  - executes:
    `python backend/manage.py test apps.accounts.tests.test_api_compat apps.iam.tests.test_permissions --settings=config.settings.test`
- `deploy_frontend`
  - runs only for non-PR builds on `main`
  - waits for both CI jobs to succeed
  - uses `vercel pull`, `vercel build --prod`, and `vercel deploy --prebuilt --prod` inside `frontend/`
- `deploy_backend`
  - runs only for non-PR builds on `main`
  - waits for both CI jobs to succeed
  - uses the same Vercel flow inside `backend/`

The workflow also uses GitHub Actions concurrency to cancel older in-progress pull-request runs on the same ref.

### Test Scope

`npm run test:ci` is intentionally a curated stable frontend suite rather than the broad `vitest run` command. The wider frontend test tree still contains additional non-gating failures, so CI uses the explicit allowlist in `frontend/package.json` to keep validation deterministic.

### Local Reproduction

You can run the same CI checks locally with:

```bash
npm --prefix frontend run test:ci
npm --prefix frontend run build
TEST_DATABASE_URL=sqlite:////tmp/dachongwms-test.sqlite3 ./.venv/bin/python backend/manage.py test apps.accounts.tests.test_api_compat apps.iam.tests.test_permissions --settings=config.settings.test
```

### Deploy Caveat

The GitHub workflow does not run Django migrations automatically after backend deploys. When schema changes are present, run:

```bash
make migrate_vercel_prod
```

## Docker Environments

The stack now separates shared Compose state from development and production behavior:

- `docker-compose.yml` — shared service definitions
- `docker-compose.dev.yml` — bind mounts, Django `runserver`, Vite dev server, exposed Postgres
- `docker-compose.prod.yml` — Gunicorn backend, Nginx frontend, private Postgres
- shared Compose now runs PostgreSQL 16 because Django 5.2 does not support PostgreSQL 13

### Development

1. Copy `.env.dev.example` to `.env.dev` if you do not already have a local dev env file.
2. Copy `frontend/.env.example` to `frontend/.env.local` if you run the Vite app directly outside Docker.
3. Start the stack:

```bash
make dev DEV_ENV_FILE=.env.dev
# or: make dev_build DEV_ENV_FILE=.env.dev
```

The frontend runs on `http://localhost:5173` through Vite. `/api`, `/admin`, `/media`, and `/static` are proxied to the backend container.

### Backend Without Docker

If you want to run Django directly on your machine and generate migration files without the backend container:

1. Create the virtualenv and install backend dependencies:

```bash
make venv
```

2. Copy `backend/.env.local.example` to `backend/.env.local` and point `DATABASE_URL` at a PostgreSQL instance reachable from your host machine, typically `127.0.0.1`.

3. Run backend commands locally:

```bash
make run_backend_local
make makemigrations_local
make migrate_local
```

Use the Docker targets only when the Compose backend service is actually running. For example, `make makemigrations` still targets the running `backend` container.
The `makemigrations` targets now use `--skip-checks` so Django does not spend time importing the full URL/view graph before generating migration files.

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
