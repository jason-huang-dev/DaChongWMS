from .base import *  # noqa: F403


DEBUG = False
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
DATABASES["default"] = {  # noqa: F405
    "ENGINE": "django.db.backends.sqlite3",
    "NAME": ":memory:",
}
