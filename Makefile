PYTHON ?= python3
PROD_ENV_FILE ?= .env.prod
TEST_TARGET ?=
COMMIT_MSG ?= no message update
BRANCH_NAME ?= main
PARAMS ?= --ff-only
DUMP_FILE ?= tmp/pg13-to-pg16.dump
OLD_PG13_VOLUME ?= dachongwms_db_data

COMPOSE_DEV := docker compose -f docker-compose.yml -f docker-compose.dev.yml
COMPOSE_PROD := docker compose --env-file $(PROD_ENV_FILE) -f docker-compose.yml -f docker-compose.prod.yml
MANAGE_DEV := $(COMPOSE_DEV) exec backend python manage.py
MANAGE_PROD := $(COMPOSE_PROD) exec backend python manage.py

.DEFAULT_GOAL := update

.PHONY: help \
	dev run dev_build build build_no_cache \
	prod run_prod prod_build build_prod \
	down down_dev down_prod clean_docker \
	venv migrate migrate_prod makemigrations showmigrations createsuperuser \
	export_pg13_dump import_pg13_dump \
	check_tables flush_db db_relations test_backend \
	update_from_branch push_to_branch update update_run push migrate_and_update \
	run_local

help:
	@printf "%s\n" \
		"Common targets:" \
		"  make dev                     Start the development stack" \
		"  make dev_build               Rebuild and start the development stack" \
		"  make prod PROD_ENV_FILE=.env.prod" \
		"                              Start the production stack" \
		"  make prod_build PROD_ENV_FILE=.env.prod" \
		"                              Rebuild and start the production stack" \
		"  make migrate                Run Django migrations in dev" \
		"  make migrate_prod PROD_ENV_FILE=.env.prod" \
		"                              Run Django migrations in prod" \
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

# Django
migrate:
	$(MANAGE_DEV) migrate

migrate_prod:
	$(MANAGE_PROD) migrate

makemigrations:
	$(MANAGE_DEV) makemigrations

showmigrations:
	$(MANAGE_DEV) showmigrations

createsuperuser:
	$(MANAGE_DEV) createsuperuser

check_tables:
	$(COMPOSE_DEV) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "\\dt"'

flush_db:
	$(COMPOSE_DEV) exec db sh -c 'psql -U "$$POSTGRES_USER" -d "$$POSTGRES_DB" -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"'
	$(MANAGE_DEV) flush

db_relations:
	mkdir -p backend/docs/diagrams
	$(MANAGE_DEV) graph_models --arrow-shape normal -a -o docs/diagrams/er-diagram.svg

test_backend:
	$(MANAGE_DEV) test $(TEST_TARGET)

export_pg13_dump:
	OLD_PG13_VOLUME=$(OLD_PG13_VOLUME) DUMP_FILE=$(DUMP_FILE) ./scripts/migrate_pg13_to_pg16.sh export

import_pg13_dump:
	DUMP_FILE=$(DUMP_FILE) ./scripts/migrate_pg13_to_pg16.sh import

# Git workflow
update_from_branch:
	git stash
	git pull origin $(BRANCH_NAME) $(PARAMS)
	-git stash pop

push_to_branch:
	git stash
	git pull origin $(BRANCH_NAME) $(PARAMS)
	-git stash pop
	git add .
	git commit -m "$(COMMIT_MSG)"
	git push origin $(BRANCH_NAME)

update:
	git stash
	git pull $(PARAMS)
	-git stash pop

update_run:
	git stash
	git pull $(PARAMS)
	-git stash pop
	$(MAKE) dev
	$(MAKE) migrate

push:
	git stash
	git pull $(PARAMS)
	-git stash pop
	git add .
	git commit -m "$(COMMIT_MSG)"
	git push

migrate_and_update: update makemigrations migrate
