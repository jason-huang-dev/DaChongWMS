from __future__ import annotations

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.organizations.models import MembershipType, OrganizationMembership
from apps.organizations.tests.test_factories import make_customer_account, make_organization
from apps.partners.services.customer_accounts import grant_client_account_access


class CurrentUserAPITests(TestCase):
    def test_returns_user_profile_and_memberships(self) -> None:
        client = APIClient()
        user = User.objects.create_user(email="viewer@example.com", password="secret", full_name="Viewer")
        organization = make_organization()
        membership = OrganizationMembership.objects.create(
            user=user,
            organization=organization,
            membership_type=MembershipType.CLIENT,
        )
        customer_account = make_customer_account(organization)
        grant_client_account_access(
            membership=membership,
            customer_account=customer_account,
        )
        client.force_authenticate(user=user)

        response = client.get(reverse("auth-current-user"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["email"], user.email)
        self.assertEqual(response.data["memberships"][0]["organization_id"], membership.organization_id)
        self.assertEqual(
            response.data["memberships"][0]["customer_accounts"][0]["customer_account_id"],
            customer_account.id,
        )
