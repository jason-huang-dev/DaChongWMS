from __future__ import annotations

import os
from unittest import mock

from django.test import SimpleTestCase

from apps.common import env


class EnvHelperTests(SimpleTestCase):
    def test_split_env_trims_and_ignores_blank_entries(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": " api.example.com , ,internal "}, clear=True):
            self.assertEqual(env.split_env("DJANGO_ALLOWED_HOSTS"), ["api.example.com", "internal"])

    def test_env_bool_understands_common_truthy_strings(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_DEBUG": "On"}, clear=True):
            self.assertTrue(env.env_bool("DJANGO_DEBUG", default=False))
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertFalse(env.env_bool("UNSET_FLAG", default=False))

    def test_build_allowed_hosts_adds_debug_extras(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_ALLOWED_HOSTS": "localhost,127.0.0.1"}, clear=True):
            self.assertEqual(
                env.build_allowed_hosts(
                    debug=True,
                    default_hosts=("localhost", "127.0.0.1"),
                    extra_hosts=("0.0.0.0", "backend", "frontend", "host.docker.internal"),
                ),
                ["localhost", "127.0.0.1", "0.0.0.0", "backend", "frontend", "host.docker.internal"],
            )

    def test_database_conn_max_age_uses_override(self) -> None:
        with mock.patch.dict(os.environ, {"DJANGO_DB_CONN_MAX_AGE": "120"}, clear=True):
            self.assertEqual(env.database_conn_max_age(debug=True), 120)

    def test_database_conn_max_age_defaults_to_zero_in_debug(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(env.database_conn_max_age(debug=True), 0)

    def test_database_url_defaults_to_postgres(self) -> None:
        with mock.patch.dict(os.environ, {}, clear=True):
            self.assertEqual(
                env.database_url(),
                "postgres://myuser:mypassword@localhost:5432/mydatabase",
            )

    def test_database_url_uses_requested_environment_variable(self) -> None:
        with mock.patch.dict(os.environ, {"TEST_DATABASE_URL": "postgres://tester:secret@db:5432/test_db"}, clear=True):
            self.assertEqual(
                env.database_url(env_name="TEST_DATABASE_URL"),
                "postgres://tester:secret@db:5432/test_db",
            )
