from __future__ import annotations

import importlib
import os
from unittest import mock

from django.test import SimpleTestCase
from django.urls import resolve, reverse

from apps.common import env as env_helpers
from config.settings import base as base_settings
from config.settings import dev as dev_settings
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

        self.assertIn("backend", reloaded_dev_settings.ALLOWED_HOSTS)
        self.assertIn("frontend", reloaded_dev_settings.ALLOWED_HOSTS)
        self.assertIn("host.docker.internal", reloaded_dev_settings.ALLOWED_HOSTS)


class SharedEnvHelpersTests(SimpleTestCase):
    def test_modular_settings_share_first_class_env_helpers(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_DEBUG": "true"}, clear=True):
            self.assertTrue(env_helpers.env_bool("DJANGO_DEBUG"))
