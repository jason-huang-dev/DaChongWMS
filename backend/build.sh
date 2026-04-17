#!/bin/sh
set -eu

cd "$(dirname "$0")"

python manage.py collectstatic --noinput
