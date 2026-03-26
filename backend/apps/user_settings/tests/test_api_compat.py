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
        self.assertEqual(response.data["visible_widget_keys"], ["metrics", "ops-summary", "queues"])
        self.assertEqual(response.data["right_rail_widget_keys"], ["alerts", "help"])
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
                "time_window": "MONTH",
                "visible_widget_keys": ["ops-summary", "queues"],
                "right_rail_widget_keys": ["alerts"],
                "layout_payload": {
                    "hidden_queue_section_keys": ["return"],
                    "hidden_queue_metric_keys": ["stock-in-pending"],
                },
            },
            format="json",
        )

        self.assertEqual(patch_response.status_code, status.HTTP_200_OK)
        self.assertEqual(patch_response.data["visible_widget_keys"], ["ops-summary", "queues"])
        self.assertEqual(patch_response.data["right_rail_widget_keys"], ["alerts"])
        self.assertEqual(
            patch_response.data["layout_payload"],
            {
                "hidden_widget_keys": ["metrics"],
                "hidden_right_rail_widget_keys": ["help"],
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
                "time_window": "MONTH",
                "hidden_widget_keys": ["metrics"],
                "hidden_right_rail_widget_keys": ["help"],
                "hidden_queue_section_keys": ["return"],
                "hidden_queue_metric_keys": ["stock-in-pending"],
            },
        )

        get_response = self.client.get(
            reverse("compat-workbench-preference-current"),
            {"page_key": "dashboard"},
        )

        self.assertEqual(get_response.status_code, status.HTTP_200_OK)
        self.assertEqual(get_response.data["time_window"], "MONTH")
        self.assertEqual(get_response.data["visible_widget_keys"], ["ops-summary", "queues"])
        self.assertEqual(get_response.data["right_rail_widget_keys"], ["alerts"])
