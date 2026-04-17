from apps.common.env import build_allowed_hosts, split_env

from .base import *  # noqa: F403


DEBUG = True

ALLOWED_HOSTS = build_allowed_hosts(
    debug=DEBUG,
    default_hosts=("localhost", "127.0.0.1", "0.0.0.0"),
    extra_hosts=("backend", "frontend", "host.docker.internal"),
)

CORS_ALLOWED_ORIGINS = split_env("DJANGO_CORS_ALLOWED_ORIGINS") or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
CSRF_TRUSTED_ORIGINS = split_env("DJANGO_CSRF_TRUSTED_ORIGINS") or [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
