from apps.common.env import build_allowed_hosts

from .base import *  # noqa: F403


DEBUG = True

ALLOWED_HOSTS = build_allowed_hosts(
    debug=DEBUG,
    default_hosts=("localhost", "127.0.0.1", "0.0.0.0"),
    extra_hosts=("backend", "frontend", "host.docker.internal"),
)
