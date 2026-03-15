"""Centralized Django settings for the DaChongWMS backend.

The module mirrors Django's default layout but groups related configuration
under clearly labeled sections so infrastructure, API, and platform changes
are easy to audit.
"""

# cSpell:ignore DaChongWMS corsheaders authtoken userregister dachong asgi Authtication Chong dachongwms

import os
from pathlib import Path
from typing import Any, Dict, List

import dj_database_url

# Base project paths ---------------------------------------------------------
BASE_DIR = Path(__file__).resolve().parent.parent


def _split_env(name: str) -> List[str]:
    """Return a sanitized list derived from a comma-delimited environment var."""

    raw_value = os.getenv(name, "")
    if not raw_value:
        return []
    return [item.strip() for item in raw_value.split(",") if item.strip()]


def _env_bool(name: str, default: bool = False) -> bool:
    """Interpret common truthy strings from the environment as booleans."""

    value = os.getenv(name)
    if value is None:
        return default
    return value.lower() in {"1", "true", "yes", "on"}


def _build_allowed_hosts() -> List[str]:
    hosts = _split_env("DJANGO_ALLOWED_HOSTS") or ["localhost", "127.0.0.1"]
    if DEBUG:
        for host in ("0.0.0.0", "backend", "frontend", "host.docker.internal"):
            if host not in hosts:
                hosts.append(host)
    return hosts


# Core settings --------------------------------------------------------------
SECRET_KEY = os.getenv(
    "DJANGO_SECRET_KEY",
    "insecure-dev-secret-key-change-me",
)

DEBUG = _env_bool("DJANGO_DEBUG", default=True)

ALLOWED_HOSTS = _build_allowed_hosts()

# Applications ---------------------------------------------------------------
DJANGO_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
]

THIRD_PARTY_APPS = [
    "corsheaders",
    "rest_framework",
    "rest_framework.authtoken",
    "django_filters",
    "drf_spectacular",
    "django_extensions",
]

CATALOG_APPS: List[str] = [
    "catalog.goods.apps.GoodsConfig",
    "catalog.goodsunit.apps.GoodsunitConfig",
    "catalog.goodsclass.apps.GoodsclassConfig",
    "catalog.goodsbrand.apps.GoodsbrandConfig",
    "catalog.goodscolor.apps.GoodscolorConfig",
    "catalog.goodsshape.apps.GoodsshapeConfig",
    "catalog.goodsspecs.apps.GoodsspecsConfig",
    "catalog.goodsorigin.apps.GoodsoriginConfig",
]

LOCAL_APPS: List[str] = [
    "userprofile",
    "mfa.apps.MfaConfig",
    "warehouse",
    "locations.apps.LocationsConfig",
    "inventory.apps.InventoryConfig",
    "automation.apps.AutomationConfig",
    "integrations.apps.IntegrationsConfig",
    "operations.inbound.apps.InboundConfig",
    "operations.outbound.apps.OutboundConfig",
    "operations.counting.apps.CountingConfig",
    "operations.transfers.apps.TransfersConfig",
    "operations.returns.apps.ReturnsConfig",
    "reporting.apps.ReportingConfig",
    "staff",
    "userlogin",
    "test_system.apps.TestSystemConfig",
    "uploadfile",
    "supplier",
    "customer",
    "payment",
    "capital",
    "scanner",
]

INSTALLED_APPS = DJANGO_APPS + THIRD_PARTY_APPS + LOCAL_APPS + CATALOG_APPS

# Middleware -----------------------------------------------------------------
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

# URL / WSGI / ASGI ----------------------------------------------------------
ROOT_URLCONF = "dachong_wms.urls"

WSGI_APPLICATION = "dachong_wms.wsgi.application"

ASGI_APPLICATION = "dachong_wms.asgi.application"

# Templates ------------------------------------------------------------------
TemplateConfig = Dict[str, Any]
TEMPLATES: List[TemplateConfig] = [
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
    },
]

DatabaseConfig = Dict[str, Any]
DATABASES: Dict[str, DatabaseConfig] = {
    "default": dj_database_url.config(
        default=f"sqlite:///{BASE_DIR / 'db.sqlite3'}",
        conn_max_age=600,
        ssl_require=_env_bool("DB_SSL_REQUIRED", default=False),
    )
}

# Passwords ------------------------------------------------------------------
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

# Internationalization -------------------------------------------------------
LANGUAGE_CODE = "en-us"
TIME_ZONE = os.getenv("DJANGO_TIME_ZONE", "UTC")
USE_I18N = True
USE_TZ = True

# Static / media -------------------------------------------------------------
STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
STATICFILES_DIRS = [BASE_DIR / "static"]
STATICFILES_STORAGE = "whitenoise.storage.CompressedManifestStaticFilesStorage"

MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# DRF / API ------------------------------------------------------------------
RESTFrameworkConfig = Dict[str, Any]
REST_FRAMEWORK: RESTFrameworkConfig = {
    "DEFAULT_AUTHENTICATION_CLASSES": [
        "utils.auth.Authtication",
        "rest_framework.authentication.SessionAuthentication",
        "rest_framework.authentication.TokenAuthentication",
    ],
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticatedOrReadOnly",
    ],
    "DEFAULT_THROTTLE_CLASSES": [
        "utils.throttle.VisitThrottle",
    ],
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 50,
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_FILTER_BACKENDS": [
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.OrderingFilter",
        "rest_framework.filters.SearchFilter",
    ],
    "EXCEPTION_HANDLER": "utils.my_exceptions.custom_exception_handler",
}

SpectacularConfig = Dict[str, Any]
SPECTACULAR_SETTINGS: SpectacularConfig = {
    "TITLE": "DaChongWMS API",
    "DESCRIPTION": "Warehouse management system backend for DaChong Logistics.",
    "VERSION": "0.1.0",
    "SERVE_INCLUDE_SCHEMA": False,
}

# CORS / CSRF ---------------------------------------------------------------
CORS_ALLOWED_ORIGINS = _split_env("DJANGO_CORS_ALLOWED_ORIGINS")
CORS_ALLOW_ALL_ORIGINS = DEBUG and not CORS_ALLOWED_ORIGINS
CORS_ALLOW_CREDENTIALS = True

CSRF_TRUSTED_ORIGINS = _split_env("DJANGO_CSRF_TRUSTED_ORIGINS")

# Legacy compatibility / rate-limits -----------------------------------------
DJANGO_JWT_SALT = os.getenv("DJANGO_JWT_SALT", "dachongwms-default-jwt-salt")
JWT_TIME = int(os.getenv("DJANGO_JWT_TIME", 60 * 60 * 24))
ALLOCATION_SECONDS = int(os.getenv("DJANGO_THROTTLE_INTERVAL", 1))
GET_THROTTLE = int(os.getenv("DJANGO_THROTTLE_GET", 500))
POST_THROTTLE = int(os.getenv("DJANGO_THROTTLE_POST", 500))
PUT_THROTTLE = int(os.getenv("DJANGO_THROTTLE_PUT", 500))
PATCH_THROTTLE = int(os.getenv("DJANGO_THROTTLE_PATCH", 500))
DELETE_THROTTLE = int(os.getenv("DJANGO_THROTTLE_DELETE", 500))
TEST_SYSTEM_ENABLED = _env_bool("DJANGO_TEST_SYSTEM_ENABLED", default=DEBUG)
MFA_ISSUER = os.getenv("DJANGO_MFA_ISSUER", "DaChongWMS")
MFA_CHALLENGE_TTL_SECONDS = int(os.getenv("DJANGO_MFA_CHALLENGE_TTL_SECONDS", 300))
MFA_RECOVERY_CODE_COUNT = int(os.getenv("DJANGO_MFA_RECOVERY_CODE_COUNT", 8))
MFA_ENCRYPTION_KEY = os.getenv("DJANGO_MFA_ENCRYPTION_KEY", SECRET_KEY)

# Logging --------------------------------------------------------------------
LoggingConfig = Dict[str, Any]
LOGGING: LoggingConfig = {
    "version": 1,
    "disable_existing_loggers": False,
    "handlers": {
        "console": {
            "class": "logging.StreamHandler",
        },
    },
    "root": {
        "handlers": ["console"],
        "level": "INFO" if DEBUG else "WARNING",
    },
}
