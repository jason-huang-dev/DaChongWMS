from __future__ import annotations

from urllib.parse import parse_qsl, urlsplit

from django.test import TestCase
from django.test import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import User
from apps.accounts.services.session_service import ensure_operator_profile, issue_session_token
from apps.counting.models import CycleCount
from apps.fees.models import ChargeItem, ManualCharge, ReceivableBill
from apps.iam.constants import PermissionCode
from apps.iam.models import Role
from apps.inbound.models import PurchaseOrder
from apps.logistics.models import LogisticsCharge, LogisticsProvider, LogisticsProviderChannel
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_permission,
    make_role,
    make_user,
)
from apps.outbound.models import SalesOrder
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.reporting.models import WarehouseKpiSnapshot
from apps.transfers.models import TransferOrder
from apps.warehouse.models import Warehouse
from apps.workorders.models import WorkOrder


class CompatibilityAuthAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.user = make_user("owner@example.com", password="secret123", full_name="Owner User")
        self.membership = add_membership(self.user, self.organization)
        self.owner_role = make_role(Role.SystemCode.OWNER)
        grant_role_permission(self.owner_role, make_permission("manage_memberships"))
        grant_role_permission(self.owner_role, make_permission("manage_client_users"))
        assign_role(self.membership, self.owner_role)

    def test_login_returns_legacy_envelope_and_header_token_authenticates_current_user(self) -> None:
        login_response = self.client.post(
            reverse("compat-login"),
            {
                "name": self.user.email,
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_200_OK)
        self.assertEqual(login_response.data["code"], "200")
        token = login_response.data["data"]["token"]
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=login_response.data["data"]["openid"],
            HTTP_OPERATOR=str(self.user.id),
        )

        me_response = self.client.get(reverse("auth-current-user"))

        self.assertEqual(me_response.status_code, status.HTTP_200_OK)
        self.assertEqual(me_response.data["email"], self.user.email)
        self.assertEqual(me_response.data["memberships"][0]["organization_id"], self.organization.id)

    def test_login_does_not_accept_full_name_identifier(self) -> None:
        login_response = self.client.post(
            reverse("compat-login"),
            {
                "name": self.user.full_name,
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(login_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(login_response.data["code"], "1011")

    def test_signup_creates_first_class_workspace_and_allows_membership_bootstrap(self) -> None:
        signup_response = self.client.post(
            reverse("compat-signup"),
            {
                "name": "Warehouse Manager",
                "email": "manager@example.com",
                "password1": "supersecret123",
                "password2": "supersecret123",
            },
            format="json",
        )

        self.assertEqual(signup_response.status_code, status.HTTP_201_CREATED)
        created_user = User.objects.get(email="manager@example.com")
        self.assertEqual(created_user.full_name, "Warehouse Manager")

        token = signup_response.data["data"]["token"]
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=signup_response.data["data"]["openid"],
            HTTP_OPERATOR=str(created_user.id),
        )
        memberships_response = self.client.get(reverse("compat-membership-list"))

        self.assertEqual(memberships_response.status_code, status.HTTP_200_OK)
        self.assertEqual(memberships_response.data["count"], 1)
        self.assertEqual(memberships_response.data["results"][0]["staff_type"], "Owner")

    def test_signup_duplicate_email_uses_generic_error_message(self) -> None:
        signup_response = self.client.post(
            reverse("compat-signup"),
            {
                "name": "Owner User",
                "email": self.user.email,
                "password1": "supersecret123",
                "password2": "supersecret123",
            },
            format="json",
        )

        self.assertEqual(signup_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(signup_response.data["code"], "1016")
        self.assertEqual(
            signup_response.data["msg"],
            "Unable to create an account with the provided information.",
        )
        self.assertIsNone(signup_response.data["data"])

    def test_staff_detail_and_role_type_endpoints_use_current_membership_context(self) -> None:
        token = issue_session_token(membership=self.membership)
        operator_profile = ensure_operator_profile(self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        detail_response = self.client.get(
            reverse("compat-staff-detail", kwargs={"staff_id": operator_profile.id})
        )
        role_types_response = self.client.get(reverse("compat-staff-type-list"))

        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.data["staff_name"], self.user.display_name)
        self.assertEqual(detail_response.data["staff_type"], "Owner")
        self.assertIn(PermissionCode.MANAGE_CLIENT_USERS, detail_response.data["permission_codes"])
        self.assertIn(PermissionCode.MANAGE_MEMBERSHIPS, detail_response.data["permission_codes"])
        self.assertIn(PermissionCode.VIEW_INBOUND, detail_response.data["permission_codes"])
        self.assertEqual(role_types_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(role_types_response.data["count"], 1)

    def test_staff_directory_list_create_and_update_use_first_class_profiles(self) -> None:
        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        create_response = self.client.post(
            reverse("compat-staff-list"),
            {
                "staff_name": "Scanner Operator",
                "staff_type": "Staff",
                "check_code": 4321,
                "is_lock": False,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        staff_id = create_response.data["id"]

        list_response = self.client.get(reverse("compat-staff-list"))
        update_response = self.client.patch(
            reverse("compat-staff-detail", kwargs={"staff_id": staff_id}),
            {
                "staff_name": "Scanner Lead",
                "staff_type": "Manager",
                "check_code": 5678,
                "is_lock": True,
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["staff_name"], "Scanner Lead")
        self.assertTrue(update_response.data["is_lock"])

    @override_settings(
        TEST_SYSTEM_ENABLED=True,
        TEST_SYSTEM_DEFAULT_EMAIL="test-system-admin@example.com",
        TEST_SYSTEM_DEFAULT_PASSWORD="TestSystem123!",
        TEST_SYSTEM_DEFAULT_NAME="Test System Admin",
        TEST_SYSTEM_DEFAULT_ORGANIZATION_NAME="Test System Organization",
        TEST_SYSTEM_DEFAULT_WAREHOUSE_NAME="Main Warehouse",
        TEST_SYSTEM_DEFAULT_WAREHOUSE_CODE="MAIN",
    )
    def test_test_system_bootstrap_reuses_the_default_dev_user_and_workspace(self) -> None:
        first_response = self.client.post(
            reverse("compat-test-system-register"),
            {},
            format="json",
        )
        second_response = self.client.post(
            reverse("compat-test-system-register"),
            {},
            format="json",
        )

        self.assertEqual(first_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(second_response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            User.objects.filter(email="test-system-admin@example.com").count(),
            1,
        )
        self.assertEqual(
            Warehouse.objects.filter(organization__name="Test System Organization").count(),
            1,
        )
        self.assertEqual(
            first_response.data["data"]["membership_id"],
            second_response.data["data"]["membership_id"],
        )
        self.assertEqual(
            first_response.data["data"]["company_id"],
            second_response.data["data"]["company_id"],
        )
        self.assertEqual(first_response.data["data"]["seed_summary"]["users"], 1)
        self.assertEqual(first_response.data["data"]["seed_summary"]["organizations"], 1)
        self.assertEqual(first_response.data["data"]["seed_summary"]["memberships"], 1)
        self.assertEqual(first_response.data["data"]["seed_summary"]["warehouses"], 1)
        for key in (
            "customer_accounts",
            "products",
            "locations",
            "inventory",
            "transfers",
            "counting",
            "inbound",
            "outbound",
            "returns",
            "logistics",
            "fees",
            "workorders",
            "reporting",
        ):
            self.assertGreater(first_response.data["data"]["seed_summary"][key], 0)
            self.assertEqual(second_response.data["data"]["seed_summary"][key], 0)
        self.assertEqual(second_response.data["data"]["seed_summary"]["users"], 0)
        self.assertEqual(second_response.data["data"]["seed_summary"]["organizations"], 0)
        self.assertEqual(second_response.data["data"]["seed_summary"]["memberships"], 0)
        self.assertEqual(second_response.data["data"]["seed_summary"]["warehouses"], 0)
        self.client.credentials(
            HTTP_TOKEN=first_response.data["data"]["token"],
            HTTP_OPENID=first_response.data["data"]["openid"],
            HTTP_OPERATOR=str(first_response.data["data"]["user_id"]),
        )
        staff_detail_response = self.client.get(
            reverse("compat-staff-detail", kwargs={"staff_id": first_response.data["data"]["user_id"]})
        )

        self.assertTrue(CustomerAccount.objects.filter(organization__name="Test System Organization").exists())
        self.assertTrue(Product.objects.filter(organization__name="Test System Organization").exists())
        self.assertGreaterEqual(
            PurchaseOrder.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            SalesOrder.objects.filter(organization__name="Test System Organization").count(),
            3,
        )
        self.assertGreaterEqual(
            TransferOrder.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            CycleCount.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertTrue(LogisticsProvider.objects.filter(organization__name="Test System Organization").exists())
        self.assertGreaterEqual(
            LogisticsProviderChannel.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            LogisticsCharge.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            ChargeItem.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            ManualCharge.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            ReceivableBill.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            WorkOrder.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertGreaterEqual(
            WarehouseKpiSnapshot.objects.filter(organization__name="Test System Organization").count(),
            2,
        )
        self.assertEqual(staff_detail_response.status_code, status.HTTP_200_OK)
        self.assertIn(PermissionCode.MANAGE_MEMBERSHIPS, staff_detail_response.data["permission_codes"])
        self.assertIn(PermissionCode.VIEW_FEES, staff_detail_response.data["permission_codes"])


@override_settings(ENABLED_SOCIAL_AUTH_PROVIDERS=("apple", "google", "weixin"))
class SocialAuthAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()

    def test_provider_list_only_exposes_enabled_providers(self) -> None:
        response = self.client.get(reverse("auth-social-provider-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 3)
        self.assertEqual(
            [provider["id"] for provider in response.data["results"]],
            ["apple", "google", "weixin"],
        )

    def test_social_begin_redirects_to_provider_login_view(self) -> None:
        response = self.client.get(reverse("auth-social-begin", kwargs={"provider": "google"}))

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        self.assertIn("/accounts/google/login/", response["Location"])
        self.assertIn("process=login", response["Location"])

    def test_social_complete_provisions_owner_membership_for_first_login(self) -> None:
        user = make_user("social-user@example.com", full_name="Social User")
        self.client.force_login(user)

        response = self.client.get(reverse("auth-social-complete"))

        self.assertEqual(response.status_code, status.HTTP_302_FOUND)
        redirect = urlsplit(response["Location"])
        fragment = dict(parse_qsl(redirect.fragment))
        self.assertEqual(fragment["name"], user.display_name)
        self.assertTrue(fragment["token"])
        self.assertTrue(fragment["openid"])
        self.assertTrue(fragment["membership_id"])

        user.refresh_from_db()
        self.assertEqual(user.organization_memberships.filter(is_active=True).count(), 1)
