PYTHON ?= python3
VENV_PYTHON ?= .venv/bin/python

DEV_ENV_FILE ?= .env.dev
PROD_ENV_FILE ?= .env.prod
BACKEND_LOCAL_ENV_FILE ?= backend/.env.local
TEST_TARGET ?=
DUMP_FILE ?= tmp/pg13-to-pg16.dump
OLD_PG13_VOLUME ?= dachongwms_db_data

BACKEND_HOST ?= 127.0.0.1
BACKEND_PORT ?= 8000
DJANGO_DEV_SETTINGS ?= config.settings.dev
DJANGO_TEST_SETTINGS ?= config.settings.test
VERCEL_ENV ?= production

COMPOSE_DEV := docker compose --env-file $(DEV_ENV_FILE) -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := docker compose --env-file $(PROD_ENV_FILE) -f docker-compose.yml -f docker-compose.prod.yml
MANAGE_DEV := $(COMPOSE_DEV) exec backend python manage.py
MANAGE_PROD := $(COMPOSE_PROD) exec backend python manage.py

.DEFAULT_GOAL := help

.PHONY: help \
	dev run dev_build build build_no_cache \
	prod run_prod prod_build build_prod \
	down down_dev down_prod clean_docker \
	venv run_local run_backend_local \
	migrate migrate_prod migrate_local migrate_vercel_prod \
	makemigrations makemigrations_local showmigrations showmigrations_local \
	createsuperuser createsuperuser_local \
	reset_dev_db remigrate \
	export_pg13_dump import_pg13_dump \
	check_tables flush_db db_relations test_backend

help:
	@printf "%s\n" \
		"Common targets:" \
		"  make dev DEV_ENV_FILE=.env.dev" \
		"                              Start the development stack" \
		"  make dev_build DEV_ENV_FILE=.env.dev" \
		"                              Rebuild and start the development stack" \
		"  make prod PROD_ENV_FILE=.env.prod" \
		"                              Start the production stack" \
		"  make prod_build PROD_ENV_FILE=.env.prod" \
		"                              Rebuild and start the production stack" \
		"  make run_local              Run the frontend locally" \
		"  make run_backend_local      Run the Django backend locally with $(BACKEND_LOCAL_ENV_FILE)" \
		"  make migrate                Run Django migrations in dev Docker" \
		"  make migrate_local          Run Django migrations locally" \
		"  make migrate_vercel_prod    Run Django migrations against the Vercel production backend env" \
		"  make makemigrations         Create Django migrations in dev Docker" \
		"  make makemigrations_local   Create Django migrations locally" \
		"  make reset_dev_db           Drop and recreate the dev PostgreSQL schema" \
		"  make remigrate              Reset the dev PostgreSQL schema, then rerun migrations" \
		"  make export_pg13_dump OLD_PG13_VOLUME=dachongwms_db_data" \
		"                              Export the old PostgreSQL 13 volume into a dump file" \
		"  make import_pg13_dump DUMP_FILE=tmp/pg13-to-pg16.dump" \
		"                              Restore an exported PostgreSQL 13 dump into the PostgreSQL 16 dev db" \
		"  make test_backend TEST_TARGET='app.tests'" \
		"                              Run backend tests in dev"

# Docker
dev run:
	$(COMPOSE_DEV) up -d

dev_build build:
	$(COMPOSE_DEV) up -d --build

build_no_cache:
	$(COMPOSE_DEV) build --no-cache
	$(COMPOSE_DEV) up -d

prod run_prod:
	$(COMPOSE_PROD) up -d

prod_build build_prod:
	$(COMPOSE_PROD) up -d --build

down down_dev:
	$(COMPOSE_DEV) down

down_prod:
	$(COMPOSE_PROD) down

clean_docker:
	$(COMPOSE_DEV) down --rmi all --volumes --remove-orphans
	docker system prune -a

# Local setup
venv:
	$(PYTHON) -m venv .venv
	./.venv/bin/pip install -r backend/requirements.txt
	npm install --prefix frontend

run_local:
	npm run dev --prefix frontend

run_backend_local:
	@bash -lc '[ -f "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)" ] || { echo "Missing $(BACKEND_LOCAL_ENV_FILE). Copy backend/.env.local.example to $(BACKEND_LOCAL_ENV_FILE) and update DATABASE_URL."; exit 1; }; \
		set -a; . "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)"; set +a; \
		DJANGO_SETTINGS_MODULE=$${DJANGO_SETTINGS_MODULE:-$(DJANGO_DEV_SETTINGS)} "$(CURDIR)/$(VENV_PYTHON)" "$(CURDIR)/backend/manage.py" runserver $(BACKEND_HOST):$(BACKEND_PORT)'

# Django
migrate:
	$(MANAGE_DEV) migrate

migrate_prod:
	$(MANAGE_PROD) migrate

migrate_local:
	@bash -lc '[ -f "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)" ] || { echo "Missing $(BACKEND_LOCAL_ENV_FILE). Copy backend/.env.local.example to $(BACKEND_LOCAL_ENV_FILE) and update DATABASE_URL."; exit 1; }; \
		set -a; . "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)"; set +a; \
		DJANGO_SETTINGS_MODULE=$${DJANGO_SETTINGS_MODULE:-$(DJANGO_DEV_SETTINGS)} "$(CURDIR)/$(VENV_PYTHON)" "$(CURDIR)/backend/manage.py" migrate'

migrate_vercel_prod:
	cd backend && vercel env run -e $(VERCEL_ENV) -- "$(CURDIR)/$(VENV_PYTHON)" manage.py migrate

makemigrations:
	$(MANAGE_DEV) makemigrations --skip-checks

makemigrations_local:
	@bash -lc '[ -f "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)" ] || { echo "Missing $(BACKEND_LOCAL_ENV_FILE). Copy backend/.env.local.example to $(BACKEND_LOCAL_ENV_FILE) and update DATABASE_URL."; exit 1; }; \
		set -a; . "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)"; set +a; \
		DJANGO_SETTINGS_MODULE=$${DJANGO_SETTINGS_MODULE:-$(DJANGO_DEV_SETTINGS)} "$(CURDIR)/$(VENV_PYTHON)" "$(CURDIR)/backend/manage.py" makemigrations --skip-checks'

showmigrations:
	$(MANAGE_DEV) showmigrations

showmigrations_local:
	@bash -lc '[ -f "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)" ] || { echo "Missing $(BACKEND_LOCAL_ENV_FILE). Copy backend/.env.local.example to $(BACKEND_LOCAL_ENV_FILE) and update DATABASE_URL."; exit 1; }; \
		set -a; . "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)"; set +a; \
		DJANGO_SETTINGS_MODULE=$${DJANGO_SETTINGS_MODULE:-$(DJANGO_DEV_SETTINGS)} "$(CURDIR)/$(VENV_PYTHON)" "$(CURDIR)/backend/manage.py" showmigrations'

createsuperuser:
	$(MANAGE_DEV) createsuperuser

createsuperuser_local:
	@bash -lc '[ -f "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)" ] || { echo "Missing $(BACKEND_LOCAL_ENV_FILE). Copy backend/.env.local.example to $(BACKEND_LOCAL_ENV_FILE) and update DATABASE_URL."; exit 1; }; \
		set -a; . "$(CURDIR)/$(BACKEND_LOCAL_ENV_FILE)"; set +a; \
		DJANGO_SETTINGS_MODULE=$${DJANGO_SETTINGS_MODULE:-$(DJANGO_DEV_SETTINGS)} "$(CURDIR)/$(VENV_PYTHON)" "$(CURDIR)/backend/manage.py" createsuperuser'

reset_dev_db:
	$(COMPOSE_DEV) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'

remigrate: reset_dev_db migrate

check_tables:
	$(COMPOSE_DEV) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "\\dt"'

flush_db:
	$(MAKE) reset_dev_db

db_relations:
	mkdir -p backend/ai/docs/diagrams
	$(MANAGE_DEV) graph_models --arrow-shape normal -a -o ai/docs/diagrams/er-diagram.svg

test_backend:
	$(MANAGE_DEV) test $(TEST_TARGET) --settings=$(DJANGO_TEST_SETTINGS)

export_pg13_dump:
	OLD_PG13_VOLUME=$(OLD_PG13_VOLUME) DUMP_FILE=$(DUMP_FILE) ./scripts/migrate_pg13_to_pg16.sh export

import_pg13_dump:
	DUMP_FILE=$(DUMP_FILE) ./scripts/migrate_pg13_to_pg16.sh import
