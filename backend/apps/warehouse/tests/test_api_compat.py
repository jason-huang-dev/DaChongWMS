from __future__ import annotations

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.organizations.tests.test_factories import add_membership, make_organization, make_user
from apps.warehouse.models import Warehouse


class CompatibilityWarehouseAPITests(TestCase):
    def test_warehouse_bootstrap_list_uses_current_membership_organization(self) -> None:
        client = APIClient()
        user = make_user("viewer@example.com", password="secret123", full_name="Viewer User")
        organization_a = make_organization(name="Org A", slug="org-a")
        organization_b = make_organization(name="Org B", slug="org-b")
        membership_a = add_membership(user, organization_a)
        add_membership(user, organization_b)

        warehouse_a = Warehouse.objects.create(
            organization=organization_a,
            name="Primary Warehouse",
            code="WH-A",
        )
        Warehouse.objects.create(
            organization=organization_b,
            name="Other Warehouse",
            code="WH-B",
        )

        token = issue_session_token(membership=membership_a)
        client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=organization_a.slug,
            HTTP_OPERATOR=str(user.id),
        )

        response = client.get(reverse("compat-warehouse-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], warehouse_a.id)
        self.assertEqual(response.data["results"][0]["warehouse_name"], "Primary Warehouse")
