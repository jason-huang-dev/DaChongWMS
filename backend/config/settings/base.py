import os
from pathlib import Path
from urllib.parse import urlsplit

import dj_database_url
from corsheaders.defaults import default_headers
from django.core.exceptions import ImproperlyConfigured

from apps.common.env import (
    build_allowed_hosts,
    database_conn_max_age,
    database_url,
    env_bool,
    split_env,
)


BASE_DIR = Path(__file__).resolve().parents[2]


def _normalized_env_value(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


def _build_frontend_url(base_url: str, path: str) -> str:
    normalized_base = base_url.rstrip("/")
    normalized_path = path if path.startswith("/") else f"/{path}"
    return f"{normalized_base}{normalized_path}"


def _build_social_apps(*, client_id: str, secret: str, key: str = "", settings: dict[str, object] | None = None) -> list[dict[str, object]]:
    if not client_id or not secret:
        return []

    app: dict[str, object] = {
        "client_id": client_id,
        "secret": secret,
        "key": key,
    }
    if settings:
        app["settings"] = settings
    return [app]


def _build_google_provider_settings() -> dict[str, object] | None:
    apps = _build_social_apps(
        client_id=_normalized_env_value("DJANGO_SOCIAL_GOOGLE_CLIENT_ID"),
        secret=_normalized_env_value("DJANGO_SOCIAL_GOOGLE_SECRET"),
    )
    if not apps:
        return None
    return {
        "APPS": apps,
        "SCOPE": ["profile", "email"],
        "AUTH_PARAMS": {"access_type": "online"},
        "OAUTH_PKCE_ENABLED": True,
    }


def _build_apple_provider_settings() -> dict[str, object] | None:
    certificate_key = os.getenv("DJANGO_SOCIAL_APPLE_PRIVATE_KEY", "").strip()
    client_id = _normalized_env_value("DJANGO_SOCIAL_APPLE_CLIENT_ID")
    key_id = _normalized_env_value("DJANGO_SOCIAL_APPLE_KEY_ID")
    team_id = _normalized_env_value("DJANGO_SOCIAL_APPLE_TEAM_ID")
    if any((client_id, key_id, team_id, certificate_key)):
        session_cookie_samesite = _normalized_env_value("DJANGO_SESSION_COOKIE_SAMESITE", "Lax").lower()
        if session_cookie_samesite != "none":
            raise ImproperlyConfigured(
                "Apple Sign In requires DJANGO_SESSION_COOKIE_SAMESITE=None so the callback can reuse the Django session."
            )

    apps = _build_social_apps(
        client_id=client_id,
        secret=key_id,
        key=team_id,
        settings={"certificate_key": certificate_key} if certificate_key else None,
    )
    if not apps or not certificate_key:
        return None
    return {"APPS": apps}


def _build_weixin_provider_settings() -> dict[str, object] | None:
    apps = _build_social_apps(
        client_id=_normalized_env_value("DJANGO_SOCIAL_WEIXIN_CLIENT_ID"),
        secret=_normalized_env_value("DJANGO_SOCIAL_WEIXIN_SECRET"),
    )
    if not apps:
        return None

    provider_settings: dict[str, object] = {"APPS": apps}
    authorize_url = _normalized_env_value("DJANGO_SOCIAL_WEIXIN_AUTHORIZE_URL")
    if authorize_url:
        provider_settings["AUTHORIZE_URL"] = authorize_url

    scope = split_env("DJANGO_SOCIAL_WEIXIN_SCOPE")
    if scope:
        provider_settings["SCOPE"] = scope
    return provider_settings


def _build_socialaccount_providers() -> dict[str, dict[str, object]]:
    providers: dict[str, dict[str, object]] = {}
    google = _build_google_provider_settings()
    apple = _build_apple_provider_settings()
    weixin = _build_weixin_provider_settings()
    if google:
        providers["google"] = google
    if apple:
        providers["apple"] = apple
    if weixin:
        providers["weixin"] = weixin
    return providers


SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "insecure-dev-secret-key-change-me")
DEBUG = env_bool("DJANGO_DEBUG", default=False)
ALLOWED_HOSTS = build_allowed_hosts(
    debug=DEBUG,
    default_hosts=("localhost", "127.0.0.1"),
)
CORS_ALLOWED_ORIGINS = split_env("DJANGO_CORS_ALLOWED_ORIGINS")
CSRF_TRUSTED_ORIGINS = split_env("DJANGO_CSRF_TRUSTED_ORIGINS")
CORS_ALLOW_CREDENTIALS = env_bool("DJANGO_CORS_ALLOW_CREDENTIALS", default=True)
CORS_ALLOW_HEADERS = (*default_headers, "token", "openid", "operator")
SESSION_COOKIE_SAMESITE = os.getenv("DJANGO_SESSION_COOKIE_SAMESITE", "Lax")
CSRF_COOKIE_SAMESITE = os.getenv("DJANGO_CSRF_COOKIE_SAMESITE", "Lax")
SESSION_COOKIE_SECURE = env_bool("DJANGO_SESSION_COOKIE_SECURE", default=not DEBUG)
CSRF_COOKIE_SECURE = env_bool("DJANGO_CSRF_COOKIE_SECURE", default=not DEBUG)
FRONTEND_BASE_URL = _normalized_env_value("FRONTEND_BASE_URL") or (
    CORS_ALLOWED_ORIGINS[0] if CORS_ALLOWED_ORIGINS else "http://localhost:5173"
)
FRONTEND_LOGIN_PATH = _normalized_env_value("FRONTEND_LOGIN_PATH", "/login") or "/login"
FRONTEND_SOCIAL_AUTH_CALLBACK_PATH = _normalized_env_value(
    "FRONTEND_SOCIAL_AUTH_CALLBACK_PATH",
    "/auth/social/callback",
) or "/auth/social/callback"
FRONTEND_SOCIAL_AUTH_CALLBACK_URL = _build_frontend_url(FRONTEND_BASE_URL, FRONTEND_SOCIAL_AUTH_CALLBACK_PATH)
FRONTEND_LOGIN_URL = _build_frontend_url(FRONTEND_BASE_URL, FRONTEND_LOGIN_PATH)
FRONTEND_HOST = urlsplit(FRONTEND_BASE_URL).hostname or ""
SOCIALACCOUNT_PROVIDERS = _build_socialaccount_providers()
ENABLED_SOCIAL_AUTH_PROVIDERS = tuple(sorted(SOCIALACCOUNT_PROVIDERS.keys()))

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.socialaccount.providers.apple",
    "allauth.socialaccount.providers.google",
    "allauth.socialaccount.providers.weixin",
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
    "allauth.account.middleware.AccountMiddleware",
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
AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]
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
LOGIN_REDIRECT_URL = "/api/v1/auth/social/complete/"
LOGOUT_REDIRECT_URL = FRONTEND_LOGIN_URL
ACCOUNT_ADAPTER = "apps.accounts.account_adapters.WarehouseAccountAdapter"
SOCIALACCOUNT_ADAPTER = "apps.accounts.account_adapters.WarehouseSocialAccountAdapter"
ACCOUNT_USER_MODEL_USERNAME_FIELD = None
ACCOUNT_USER_MODEL_EMAIL_FIELD = "email"
ACCOUNT_SIGNUP_FIELDS = ["email*", "password1*", "password2*"]
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_PREVENT_ENUMERATION = True
ACCOUNT_EMAIL_UNKNOWN_ACCOUNTS = True
ACCOUNT_RATE_LIMITS = {
    "login": "12/m/ip",
    "login_failed": "6/10m/key,24/h/ip",
    "signup": "6/h/ip",
}
SOCIALACCOUNT_AUTO_SIGNUP = True
SOCIALACCOUNT_STORE_TOKENS = False

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
    "DEFAULT_THROTTLE_RATES": {
        "auth_login": "10/min",
        "auth_signup": "5/hour",
        "auth_social_begin": "10/min",
        "auth_social_providers": "30/min",
    },
}
