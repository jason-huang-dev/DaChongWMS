import dj_database_url

from apps.common.env import database_url, env_bool

from .base import *  # noqa: F403


DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_SSL_REDIRECT = False

DATABASES["default"] = dj_database_url.config(  # noqa: F405
    conn_max_age=0,
    default=database_url(),
    ssl_require=env_bool("DB_SSL_REQUIRED", default=True),
)
