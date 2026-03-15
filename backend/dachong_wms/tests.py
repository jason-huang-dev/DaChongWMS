from __future__ import annotations

import os
from unittest import mock

from django.test import SimpleTestCase
from django.urls import resolve, reverse

from dachong_wms import settings


class SettingsHelpersTests(SimpleTestCase):
    def test_split_env_trims_and_ignores_blank_entries(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": " api.example.com , ,internal "}, clear=True):
            self.assertEqual(settings._split_env("DJANGO_ALLOWED_HOSTS"), ["api.example.com", "internal"])

    def test_env_bool_understands_common_truthy_strings(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_DEBUG": "On"}, clear=True):
            self.assertTrue(settings._env_bool("DJANGO_DEBUG", default=False))
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(settings._env_bool("UNSET_FLAG", default=False))

    def test_build_allowed_hosts_adds_container_hosts_in_debug(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1"}, clear=True):
            with mock.patch.object(settings, "DEBUG", True):
                self.assertEqual(
                    settings._build_allowed_hosts(),
                    ["localhost", "127.0.0.1", "0.0.0.0", "backend", "frontend", "host.docker.internal"],
                )

    def test_build_allowed_hosts_does_not_mutate_production_hosts(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": "api.example.com"}, clear=True):
            with mock.patch.object(settings, "DEBUG", False):
                self.assertEqual(settings._build_allowed_hosts(), ["api.example.com"])


class RootUrlsTests(SimpleTestCase):
    def test_schema_and_docs_routes_are_registered(self) -> None:
        self.assertEqual(reverse("api-docs"), "/api/docs/")
        self.assertEqual(resolve("/api/schema/").url_name, "api-schema")

    def test_warehouse_routes_are_included(self) -> None:
        self.assertEqual(reverse("warehouse-list"), "/api/warehouse/")
        self.assertEqual(reverse("warehouse-detail", kwargs={"pk": 5}), "/api/warehouse/5/")
