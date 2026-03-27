from __future__ import annotations

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.organizations.tests.test_factories import add_membership, make_organization, make_user
from apps.user_settings.models import UserSetting


class CompatibilityWorkbenchPreferencePersistenceTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("settings-user@example.com", password="secret123", full_name="Settings User")
        self.organization = make_organization(name="Settings Org", slug="settings-org")
        self.membership = add_membership(self.user, self.organization)
        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def test_get_returns_resolved_defaults_without_creating_storage(self) -> None:
        response = self.client.get(
            reverse("compat-workbench-preference-current"),
            {"page_key": "dashboard"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["page_key"], "dashboard")
        self.assertEqual(response.data["time_window"], "WEEK")
        self.assertIsNone(response.data["custom_date_from"])
        self.assertIsNone(response.data["custom_date_to"])
        self.assertEqual(response.data["visible_widget_keys"], ["ops-summary", "order-trends"])
        self.assertEqual(response.data["right_rail_widget_keys"], [])
        self.assertEqual(
            response.data["layout_payload"],
            {
                "hidden_widget_keys": [],
                "hidden_right_rail_widget_keys": [],
                "hidden_queue_section_keys": [],
                "hidden_queue_metric_keys": [],
            },
        )
        self.assertFalse(UserSetting.objects.exists())

    def test_patch_persists_hidden_overrides_only_and_get_returns_resolved_preferences(self) -> None:
        patch_response = self.client.patch(
            reverse("compat-workbench-preference-current"),
            {
                "page_key": "dashboard",
                "time_window": "CUSTOM",
                "custom_date_from": "2026-03-01",
                "custom_date_to": "2026-03-15",
                "visible_widget_keys": ["order-trends"],
                "right_rail_widget_keys": [],
                "layout_payload": {
                    "hidden_queue_section_keys": ["return"],
                    "hidden_queue_metric_keys": ["stock-in-pending"],
                },
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["time_window"], "CUSTOM")
        self.assertEqual(patch_response.data["custom_date_from"], "2026-03-01")
        self.assertEqual(patch_response.data["custom_date_to"], "2026-03-15")
        self.assertEqual(patch_response.data["visible_widget_keys"], ["order-trends"])
        self.assertEqual(patch_response.data["right_rail_widget_keys"], [])
        self.assertEqual(
            patch_response.data["layout_payload"],
            {
                "hidden_widget_keys": ["ops-summary"],
                "hidden_right_rail_widget_keys": [],
                "hidden_queue_section_keys": ["return"],
                "hidden_queue_metric_keys": ["stock-in-pending"],
            },
        )

        setting = UserSetting.objects.get(
            user=self.user,
            membership=self.membership,
            category="workbench",
            setting_key="dashboard",
        )
        self.assertEqual(
            setting.payload,
            {
                "time_window": "CUSTOM",
                "custom_date_from": "2026-03-01",
                "custom_date_to": "2026-03-15",
                "hidden_widget_keys": ["ops-summary"],
                "hidden_queue_section_keys": ["return"],
                "hidden_queue_metric_keys": ["stock-in-pending"],
            },
        )

        get_response = self.client.get(
            reverse("compat-workbench-preference-current"),
            {"page_key": "dashboard"},
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["time_window"], "CUSTOM")
        self.assertEqual(get_response.data["custom_date_from"], "2026-03-01")
        self.assertEqual(get_response.data["custom_date_to"], "2026-03-15")
        self.assertEqual(get_response.data["visible_widget_keys"], ["order-trends"])
        self.assertEqual(get_response.data["right_rail_widget_keys"], [])

    def test_patch_preserves_hour_precision_for_custom_datetime_ranges(self) -> None:
        response = self.client.patch(
            reverse("compat-workbench-preference-current"),
            {
                "page_key": "dashboard",
                "time_window": "CUSTOM",
                "custom_date_from": "2026-03-01T09:00",
                "custom_date_to": "2026-03-01T18:00",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["custom_date_from"], "2026-03-01T09:00")
        self.assertEqual(response.data["custom_date_to"], "2026-03-01T18:00")

        setting = UserSetting.objects.get(
            user=self.user,
            membership=self.membership,
            category="workbench",
            setting_key="dashboard",
        )
        self.assertEqual(setting.payload["custom_date_from"], "2026-03-01T09:00")
        self.assertEqual(setting.payload["custom_date_to"], "2026-03-01T18:00")
