from __future__ import annotations

import os
from typing import Iterable


DEFAULT_POSTGRES_DATABASE_URL = "postgres://myuser:mypassword@localhost:5432/mydatabase"


def split_env(name: str) -> list[str]:
    raw_value = os.getenv(name, "")
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def env_bool(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def build_allowed_hosts(
    *,
    debug: bool,
    default_hosts: Iterable[str],
    extra_hosts: Iterable[str] = (),
    env_name: str = "DJANGO_ALLOWED_HOSTS",
) -> list[str]:
    hosts = split_env(env_name) or list(default_hosts)
    if debug:
        for host in extra_hosts:
            if host not in hosts:
                hosts.append(host)
    return hosts


def database_conn_max_age(
    *,
    debug: bool,
    env_name: str = "DJANGO_DB_CONN_MAX_AGE",
    production_default: int = 600,
) -> int:
    raw_value = os.getenv(env_name)
    if raw_value is not None:
        return int(raw_value)
    return 0 if debug else production_default


def database_url(
    *,
    env_name: str = "DATABASE_URL",
    default_url: str = DEFAULT_POSTGRES_DATABASE_URL,
) -> str:
    return os.getenv(env_name, default_url)
