from __future__ import annotations

import importlib
import os
from unittest import mock

from django.test import SimpleTestCase
from django.urls import resolve, reverse

from apps.common import env as env_helpers
from config.settings import base as base_settings
from config.settings import dev as dev_settings
from config.settings import prod as prod_settings
from config.settings import test as test_settings


class ConfigProjectTests(SimpleTestCase):
    def test_config_test_settings_use_config_project_entrypoints(self) -> None:
        self.assertEqual(test_settings.ROOT_URLCONF, "config.urls")
        self.assertEqual(test_settings.WSGI_APPLICATION, "config.wsgi.application")
        self.assertEqual(test_settings.ASGI_APPLICATION, "config.asgi.application")

    def test_health_and_compat_routes_resolve_from_config_urls(self) -> None:
        self.assertEqual(reverse("healthcheck"), "/health/")
        self.assertEqual(reverse("compat-login"), "/api/login/")
        self.assertEqual(reverse("compat-company-invite-accept"), "/api/access/company-invites/accept/")
        self.assertEqual(resolve("/health/").url_name, "healthcheck")

    def test_dev_settings_allow_docker_service_hosts(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1,0.0.0.0,backend,frontend,host.docker.internal",
                "DJANGO_DEBUG": "true",
            },
            clear=False,
        ):
            importlib.reload(base_settings)
            reloaded_dev_settings = importlib.reload(dev_settings)

        try:
            self.assertIn("backend", reloaded_dev_settings.ALLOWED_HOSTS)
            self.assertIn("frontend", reloaded_dev_settings.ALLOWED_HOSTS)
            self.assertIn("host.docker.internal", reloaded_dev_settings.ALLOWED_HOSTS)
        finally:
            importlib.reload(base_settings)
            importlib.reload(dev_settings)

    def test_base_settings_enable_whitenoise_and_cors_support(self) -> None:
        self.assertIn("corsheaders", base_settings.INSTALLED_APPS)
        self.assertIn("whitenoise.middleware.WhiteNoiseMiddleware", base_settings.MIDDLEWARE)
        self.assertIn("corsheaders.middleware.CorsMiddleware", base_settings.MIDDLEWARE)

    def test_base_settings_parse_cors_and_csrf_origin_lists_from_env(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "DJANGO_CORS_ALLOWED_ORIGINS": "https://app.example.com, https://preview.example.com ",
                "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.example.com,https://api.example.com",
            },
            clear=False,
        ):
            reloaded_base_settings = importlib.reload(base_settings)

        try:
            self.assertEqual(
                reloaded_base_settings.CORS_ALLOWED_ORIGINS,
                ["https://app.example.com", "https://preview.example.com"],
            )
            self.assertEqual(
                reloaded_base_settings.CSRF_TRUSTED_ORIGINS,
                ["https://app.example.com", "https://api.example.com"],
            )
        finally:
            importlib.reload(base_settings)

    def test_base_settings_allow_cookie_policy_overrides_from_env(self) -> None:
        with mock.patch.dict(
            os.environ,
            {
                "DJANGO_SESSION_COOKIE_SAMESITE": "None",
                "DJANGO_CSRF_COOKIE_SAMESITE": "None",
            },
            clear=False,
        ):
            reloaded_base_settings = importlib.reload(base_settings)

        try:
            self.assertEqual(reloaded_base_settings.SESSION_COOKIE_SAMESITE, "None")
            self.assertEqual(reloaded_base_settings.CSRF_COOKIE_SAMESITE, "None")
        finally:
            importlib.reload(base_settings)

    def test_prod_settings_use_serverless_friendly_database_defaults(self) -> None:
        reloaded_prod_settings = importlib.reload(prod_settings)

        self.assertEqual(reloaded_prod_settings.DATABASES["default"]["CONN_MAX_AGE"], 0)
        self.assertFalse(reloaded_prod_settings.SECURE_SSL_REDIRECT)
        self.assertTrue(reloaded_prod_settings.CSRF_COOKIE_SECURE)
        self.assertTrue(reloaded_prod_settings.SESSION_COOKIE_SECURE)


class SharedEnvHelpersTests(SimpleTestCase):
    def test_modular_settings_share_first_class_env_helpers(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_DEBUG": "true"}, clear=True):
            self.assertTrue(env_helpers.env_bool("DJANGO_DEBUG"))
