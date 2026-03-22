from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase

from apps.iam.models import Role
from apps.organizations.models import MembershipType

from .test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_customer_account,
    make_organization,
    make_permission,
    make_role,
    make_user,
)


class OrganizationUserCreateAPITests(APITestCase):
    def setUp(self):
        self.organization = make_organization()
        self.customer_account = make_customer_account(self.organization)
        self.owner = make_user("owner@example.com")
        self.staff = make_user("staff@example.com")

        manage_memberships = make_permission("manage_memberships")
        owner_role = make_role(Role.SystemCode.OWNER)
        make_role(Role.SystemCode.MANAGER)
        grant_role_permission(owner_role, manage_memberships)

        owner_membership = add_membership(self.owner, self.organization)
        add_membership(self.staff, self.organization)

        assign_role(owner_membership, owner_role)

    def test_owner_can_create_manager(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse(
            "organization-user-create",
            kwargs={"organization_id": self.organization.id},
        )
        response = self.client.post(
            url,
            {
                "email": "newmanager@example.com",
                "full_name": "New Manager",
                "membership_type": MembershipType.INTERNAL,
                "role_code": Role.SystemCode.MANAGER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["membership_type"], MembershipType.INTERNAL)
        self.assertEqual(response.data["role_codes"], [Role.SystemCode.MANAGER])

    def test_staff_cannot_create_users(self):
        self.client.force_authenticate(user=self.staff)
        url = reverse(
            "organization-user-create",
            kwargs={"organization_id": self.organization.id},
        )
        response = self.client.post(
            url,
            {
                "email": "bad@example.com",
                "full_name": "Bad Attempt",
                "membership_type": MembershipType.INTERNAL,
                "role_code": Role.SystemCode.CLIENT_USER,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_owner_can_create_client_user_for_customer_account(self):
        self.client.force_authenticate(user=self.owner)
        url = reverse(
            "organization-user-create",
            kwargs={"organization_id": self.organization.id},
        )
        response = self.client.post(
            url,
            {
                "email": "client-user@example.com",
                "full_name": "Client User",
                "membership_type": MembershipType.CLIENT,
                "customer_account_id": self.customer_account.id,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["membership_type"], MembershipType.CLIENT)
        self.assertEqual(response.data["customer_account_ids"], [self.customer_account.id])
