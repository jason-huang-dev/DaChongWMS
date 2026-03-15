#!/bin/sh
set -eu

ACTION=${1:-}
ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
OLD_PG13_VOLUME=${OLD_PG13_VOLUME:-dachongwms_db_data}
OLD_PG13_CONTAINER=${OLD_PG13_CONTAINER:-dachongwms_pg13_export}
OLD_PG13_PORT=${OLD_PG13_PORT:-55432}
DUMP_FILE=${DUMP_FILE:-$ROOT_DIR/tmp/pg13-to-pg16.dump}
POSTGRES_DB=${POSTGRES_DB:-mydatabase}
POSTGRES_USER=${POSTGRES_USER:-myuser}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-mypassword}

compose() {
  docker compose -f "$ROOT_DIR/docker-compose.yml" -f "$ROOT_DIR/docker-compose.dev.yml" "$@"
}

wait_for_pg13() {
  attempts=0
  until docker exec "$OLD_PG13_CONTAINER" pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB" >/dev/null 2>&1; do
    attempts=$((attempts + 1))
    if [ "$attempts" -ge 30 ]; then
      echo "Timed out waiting for PostgreSQL 13 export container" >&2
      exit 1
    fi
    sleep 1
  done
}

cleanup_old_container() {
  docker rm -f "$OLD_PG13_CONTAINER" >/dev/null 2>&1 || true
}

case "$ACTION" in
  export)
    docker volume inspect "$OLD_PG13_VOLUME" >/dev/null
    mkdir -p "$(dirname -- "$DUMP_FILE")"
    cleanup_old_container
    docker run -d --rm \
      --name "$OLD_PG13_CONTAINER" \
      -e POSTGRES_DB="$POSTGRES_DB" \
      -e POSTGRES_USER="$POSTGRES_USER" \
      -e POSTGRES_PASSWORD="$POSTGRES_PASSWORD" \
      -p "$OLD_PG13_PORT:5432" \
      -v "$OLD_PG13_VOLUME:/var/lib/postgresql/data" \
      postgres:13 >/dev/null
    trap cleanup_old_container EXIT INT TERM
    wait_for_pg13
    docker exec "$OLD_PG13_CONTAINER" \
      pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc -f /tmp/pg13-to-pg16.dump
    docker cp "$OLD_PG13_CONTAINER:/tmp/pg13-to-pg16.dump" "$DUMP_FILE"
    echo "Exported PostgreSQL 13 data to $DUMP_FILE"
    ;;
  import)
    if [ ! -f "$DUMP_FILE" ]; then
      echo "Dump file not found: $DUMP_FILE" >&2
      exit 1
    fi
    compose up -d db >/dev/null
    docker cp "$DUMP_FILE" postgres_db:/tmp/pg13-to-pg16.dump
    compose exec -T db sh -lc '
      set -eu
      export PGPASSWORD="$POSTGRES_PASSWORD"
      dropdb --if-exists -U "$POSTGRES_USER" "$POSTGRES_DB"
      createdb -U "$POSTGRES_USER" "$POSTGRES_DB"
      pg_restore --clean --if-exists -U "$POSTGRES_USER" -d "$POSTGRES_DB" /tmp/pg13-to-pg16.dump
      rm -f /tmp/pg13-to-pg16.dump
    '
    echo "Imported $DUMP_FILE into the PostgreSQL 16 dev database"
    ;;
  *)
    echo "Usage: $0 export|import" >&2
    exit 1
    ;;
esac
