import os
from pathlib import Path

import dj_database_url

from apps.common.env import (
    build_allowed_hosts,
    database_conn_max_age,
    database_url,
    env_bool,
    split_env,
)


BASE_DIR = Path(__file__).resolve().parents[2]
SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = build_allowed_hosts(
    debug=DEBUG,
    default_hosts=("localhost", "127.0.0.1"),
)
CORS_ALLOWED_ORIGINS = split_env("DJANGO_CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = split_env("DJANGO_CSRF_TRUSTED_ORIGINS")
CORS_ALLOW_CREDENTIALS = env_bool("DJANGO_CORS_ALLOW_CREDENTIALS", default=True)
SESSION_COOKIE_SAMESITE = os.getenv("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("DJANGO_CSRF_COOKIE_SAMESITE", "Lax")

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "corsheaders",
    "rest_framework",
    "django_filters",
    "apps.accounts.apps.AccountsConfig",
    "apps.organizations.apps.OrganizationsConfig",
    "apps.iam.apps.IamConfig",
    "apps.products.apps.ProductsConfig",
    "apps.partners.apps.PartnersConfig",
    "apps.logistics.apps.LogisticsConfig",
    "apps.fees.apps.FeesConfig",
    "apps.workorders.apps.WorkordersConfig",
    "apps.warehouse.apps.WarehouseConfig",
    "apps.locations.apps.LocationsConfig",
    "apps.inventory.apps.InventoryConfig",
    "apps.transfers.apps.TransfersConfig",
    "apps.counting.apps.CountingConfig",
    "apps.inbound.apps.InboundConfig",
    "apps.outbound.apps.OutboundConfig",
    "apps.returns.apps.ReturnsConfig",
    "apps.reporting.apps.ReportingConfig",
    "apps.user_settings.apps.UserSettingsConfig",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "whitenoise.middleware.WhiteNoiseMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

DATABASES = {
    "default": dj_database_url.config(
        conn_max_age=database_conn_max_age(debug=DEBUG),
        default=database_url(),
        ssl_require=env_bool("DB_SSL_REQUIRED", default=False),
    )
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.CommonPasswordValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.NumericPasswordValidator",
    },
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STORAGES = {
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedManifestStaticFilesStorage",
    }
}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"
TEST_SYSTEM_ENABLED = DEBUG or env_bool("DJANGO_TEST_SYSTEM_ENABLED", default=False)
TEST_SYSTEM_DEFAULT_EMAIL = os.getenv("DJANGO_TEST_SYSTEM_DEFAULT_EMAIL", "test-system-admin@example.com").strip().lower()
TEST_SYSTEM_DEFAULT_PASSWORD = os.getenv("DJANGO_TEST_SYSTEM_DEFAULT_PASSWORD", "TestSystem123!")
TEST_SYSTEM_DEFAULT_NAME = os.getenv("DJANGO_TEST_SYSTEM_DEFAULT_NAME", "Test System Admin").strip() or "Test System Admin"
TEST_SYSTEM_DEFAULT_ORGANIZATION_NAME = os.getenv(
    "DJANGO_TEST_SYSTEM_DEFAULT_ORGANIZATION_NAME",
    "Test System Organization",
).strip() or "Test System Organization"
TEST_SYSTEM_DEFAULT_WAREHOUSE_NAME = os.getenv(
    "DJANGO_TEST_SYSTEM_DEFAULT_WAREHOUSE_NAME",
    "Main Warehouse",
).strip() or "Main Warehouse"
TEST_SYSTEM_DEFAULT_WAREHOUSE_CODE = os.getenv(
    "DJANGO_TEST_SYSTEM_DEFAULT_WAREHOUSE_CODE",
    "MAIN",
).strip() or "MAIN"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "apps.accounts.authentication.LegacyHeaderAuthentication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.BasicAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
    ],
}
