import dj_database_url

from apps.common.env import database_url

from .base import *  # noqa: F403


DEBUG = False
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
DATABASES["default"] = dj_database_url.config(  # noqa: F405
    conn_max_age=0,
    default=database_url(env_name="TEST_DATABASE_URL", default_url=database_url()),
    env="TEST_DATABASE_URL",
    ssl_require=False,
)
