from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.organizations.models import MembershipType
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_role,
    make_user,
)
from apps.partners.services.customer_accounts import (
    CreateCustomerAccountInput,
    create_customer_account,
    grant_client_account_access,
)


class CustomerAccountAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.client_user = make_user("client@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.client_membership = add_membership(
            self.client_user,
            self.organization,
            membership_type=MembershipType.CLIENT,
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        client_role = make_role(
            Role.SystemCode.CLIENT_USER,
            membership_type=MembershipType.CLIENT,
        )

        for codename in (
            "manage_customer_accounts",
            "manage_client_account_access",
            "view_customeraccount",
        ):
            permission = Permission.objects.get(
                content_type__app_label="partners",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        for codename in ("view_customeraccount", "view_inventory", "view_orders", "view_charges"):
            permission = Permission.objects.get(
                content_type__app_label="partners",
                codename=codename,
            )
            grant_role_permission(client_role, permission)

        assign_role(self.manager_membership, manager_role)
        self.client_role = client_role

    def test_manager_can_create_customer_account(self) -> None:
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "organization-customer-account-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "name": "Acme Retail",
                "code": "acm-1",
                "contact_name": "Store Ops",
                "contact_email": "ops@acme.example",
                "contact_phone": "+1-555-0100",
                "billing_email": "billing@acme.example",
                "shipping_method": "Express",
                "allow_dropshipping_orders": True,
                "allow_inbound_goods": True,
                "notes": "Primary marketplace client",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "ACM-1")
        self.assertEqual(response.data["contact_name"], "Store Ops")
        self.assertTrue(response.data["allow_dropshipping_orders"])

    def test_manager_list_includes_inactive_customer_accounts(self) -> None:
        create_customer_account(
            CreateCustomerAccountInput(
                organization=self.organization,
                name="Inactive Client",
                code="INA-1",
                is_active=False,
            )
        )

        self.client.force_authenticate(self.manager)
        response = self.client.get(
            reverse(
                "organization-customer-account-list",
                kwargs={"organization_id": self.organization.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertFalse(response.data[0]["is_active"])

    def test_client_user_only_sees_assigned_customer_accounts(self) -> None:
        visible = create_customer_account(
            CreateCustomerAccountInput(
                organization=self.organization,
                name="Visible",
                code="VIS-1",
            )
        )
        create_customer_account(
            CreateCustomerAccountInput(
                organization=self.organization,
                name="Hidden",
                code="HID-1",
            )
        )
        grant_client_account_access(
            membership=self.client_membership,
            customer_account=visible,
            role_code=self.client_role.code,
        )

        self.client.force_authenticate(self.client_user)
        response = self.client.get(
            reverse(
                "organization-customer-account-list",
                kwargs={"organization_id": self.organization.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["code"], "VIS-1")
