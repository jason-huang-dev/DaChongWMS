from __future__ import annotations

from datetime import timedelta

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.iam.models import Role
from apps.organizations.models import (
    OrganizationAccessAuditAction,
    OrganizationAccessAuditEvent,
    OrganizationInvite,
    OrganizationInviteStatus,
    OrganizationPasswordReset,
    OrganizationPasswordResetStatus,
)
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_permission,
    make_role,
    make_user,
)
from apps.warehouse.models import Warehouse


class CompatibilityMembershipAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("member@example.com", password="secret123", full_name="Member User")
        self.organization_a = make_organization(name="Acme A", slug="acme-a")
        self.organization_b = make_organization(name="Acme B", slug="acme-b")
        self.membership_a = add_membership(self.user, self.organization_a)
        self.membership_b = add_membership(self.user, self.organization_b)
        self.owner_role = make_role(Role.SystemCode.OWNER)
        grant_role_permission(self.owner_role, make_permission("manage_memberships"))
        grant_role_permission(self.owner_role, make_permission("manage_client_users"))
        assign_role(self.membership_a, self.owner_role)
        assign_role(self.membership_b, self.owner_role)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization_a,
            name="Primary Warehouse",
            code="WH-A",
        )

    def test_membership_list_marks_current_membership_from_header_token(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        response = self.client.get(reverse("compat-membership-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        current_rows = [row for row in response.data["results"] if row["is_current"]]
        self.assertEqual(len(current_rows), 1)
        self.assertEqual(current_rows[0]["id"], self.membership_a.id)

    def test_activate_membership_returns_new_authenticated_payload(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        activate_response = self.client.post(
            reverse("compat-membership-activate", kwargs={"membership_id": self.membership_b.id}),
            {},
            format="json",
        )

        self.assertEqual(activate_response.status_code, status.HTTP_200_OK)
        self.assertEqual(activate_response.data["membership_id"], self.membership_b.id)

        self.client.credentials(
            HTTP_TOKEN=activate_response.data["token"],
            HTTP_OPENID=activate_response.data["openid"],
            HTTP_OPERATOR=str(self.user.id),
        )
        switched_list_response = self.client.get(reverse("compat-membership-list"))
        current_rows = [row for row in switched_list_response.data["results"] if row["is_current"]]

        self.assertEqual(len(current_rows), 1)
        self.assertEqual(current_rows[0]["id"], self.membership_b.id)

    def test_workspace_preference_stubs_return_expected_shapes(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        tabs_response = self.client.get(reverse("compat-workspace-tab-list"))
        preference_response = self.client.get(
            reverse("compat-workbench-preference-current"),
            {"page_key": "dashboard"},
        )

        self.assertEqual(tabs_response.status_code, status.HTTP_200_OK)
        self.assertEqual(tabs_response.data["results"], [])
        self.assertEqual(preference_response.status_code, status.HTTP_200_OK)
        self.assertEqual(preference_response.data["page_key"], "dashboard")

    def test_company_membership_admin_endpoints_create_update_and_list_memberships(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        create_response = self.client.post(
            reverse("compat-company-membership-list"),
            {
                "username": "ops-manager",
                "email": "ops-manager@example.com",
                "password": "verysecurepassword",
                "staff_name": "Ops Manager",
                "staff_type": "Manager",
                "check_code": 2468,
                "is_lock": False,
                "is_company_admin": True,
                "can_manage_users": True,
                "is_active": True,
                "default_warehouse": self.warehouse.id,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        membership_id = create_response.data["id"]
        self.assertEqual(create_response.data["username"], "ops-manager")
        self.assertEqual(create_response.data["default_warehouse"], self.warehouse.id)

        list_response = self.client.get(
            reverse("compat-company-membership-list"),
            {"auth_user__username__icontains": "ops"},
        )
        update_response = self.client.patch(
            reverse("compat-company-membership-detail", kwargs={"membership_id": membership_id}),
            {
                "staff_name": "Ops Manager Updated",
                "is_lock": True,
                "check_code": 1357,
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(update_response.status_code, status.HTTP_200_OK)
        self.assertEqual(update_response.data["staff_name"], "Ops Manager Updated")
        self.assertTrue(update_response.data["is_lock"])

    def test_company_membership_create_does_not_grant_admin_access_from_booleans_alone(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        create_response = self.client.post(
            reverse("compat-company-membership-list"),
            {
                "username": "floor-user",
                "email": "floor-user@example.com",
                "password": "verysecurepassword",
                "staff_name": "Floor User",
                "staff_type": "Staff",
                "check_code": 2468,
                "is_lock": False,
                "is_company_admin": True,
                "can_manage_users": True,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(create_response.status_code, status.HTTP_201_CREATED)
        self.assertFalse(create_response.data["is_company_admin"])
        self.assertFalse(create_response.data["can_manage_users"])

    def test_manager_cannot_assign_owner_role(self) -> None:
        manager_user = make_user("manager@example.com", password="secret123", full_name="Manager User")
        manager_membership = add_membership(manager_user, self.organization_a)
        manager_role = make_role(Role.SystemCode.MANAGER)
        grant_role_permission(manager_role, make_permission("manage_memberships"))
        assign_role(manager_membership, manager_role)

        token = issue_session_token(membership=manager_membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(manager_user.id),
        )

        role_types_response = self.client.get(reverse("compat-staff-type-list"))
        create_response = self.client.post(
            reverse("compat-company-membership-list"),
            {
                "username": "owner-candidate",
                "email": "owner-candidate@example.com",
                "password": "verysecurepassword",
                "staff_name": "Owner Candidate",
                "staff_type": "Owner",
                "check_code": 2468,
                "is_lock": False,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(role_types_response.status_code, status.HTTP_200_OK)
        self.assertNotIn("Owner", [row["staff_type"] for row in role_types_response.data["results"]])
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_invites_password_resets_and_audit_feed_are_backed_by_first_class_models(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

        membership_response = self.client.post(
            reverse("compat-company-membership-list"),
            {
                "username": "viewer",
                "email": "viewer@example.com",
                "password": "verysecurepassword",
                "staff_name": "Viewer User",
                "staff_type": "Staff",
                "check_code": 1111,
                "is_lock": False,
                "is_company_admin": False,
                "can_manage_users": False,
                "is_active": True,
            },
            format="json",
        )
        membership_id = membership_response.data["id"]

        invite_response = self.client.post(
            reverse("compat-company-invite-list"),
            {
                "email": "pending@example.com",
                "staff_name": "Pending User",
                "staff_type": "Staff",
                "check_code": 2222,
                "is_company_admin": False,
                "can_manage_users": False,
                "invite_message": "Welcome",
                "expires_in_days": 7,
            },
            format="json",
        )
        reset_response = self.client.post(
            reverse("compat-password-reset-list"),
            {
                "membership": membership_id,
                "expires_in_hours": 24,
                "notes": "Manual reset",
            },
            format="json",
        )

        self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(reset_response.status_code, status.HTTP_201_CREATED)

        revoke_invite_response = self.client.post(
            reverse("compat-company-invite-revoke", kwargs={"invite_id": invite_response.data["id"]}),
            {},
            format="json",
        )
        revoke_reset_response = self.client.post(
            reverse("compat-password-reset-revoke", kwargs={"reset_id": reset_response.data["id"]}),
            {},
            format="json",
        )
        audit_response = self.client.get(reverse("compat-audit-list"))

        self.assertEqual(revoke_invite_response.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_invite_response.data["status"], "REVOKED")
        self.assertEqual(revoke_reset_response.status_code, status.HTTP_200_OK)
        self.assertEqual(revoke_reset_response.data["status"], "REVOKED")
        self.assertEqual(audit_response.status_code, status.HTTP_200_OK)
        self.assertGreaterEqual(audit_response.data["count"], 5)

    def test_invite_acceptance_creates_membership_and_authenticated_payload(self) -> None:
        token = issue_session_token(membership=self.membership_a)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization_a.slug,
            HTTP_OPERATOR=str(self.user.id),
        )
        invite_response = self.client.post(
            reverse("compat-company-invite-list"),
            {
                "email": "accepted@example.com",
                "staff_name": "Accepted User",
                "staff_type": "Staff",
                "check_code": 2323,
                "default_warehouse": self.warehouse.id,
                "invite_message": "Join the warehouse",
                "expires_in_days": 7,
            },
            format="json",
        )
        self.assertEqual(invite_response.status_code, status.HTTP_201_CREATED)

        anonymous_client = APIClient()
        accept_response = anonymous_client.post(
            reverse("compat-company-invite-accept"),
            {
                "invite_token": invite_response.data["invite_token"],
                "username": "accepted-user",
                "password": "StrongPassword123!",
            },
            format="json",
        )

        self.assertEqual(accept_response.status_code, status.HTTP_201_CREATED)
        invite = OrganizationInvite.objects.get(id=invite_response.data["id"])
        self.assertEqual(invite.status, OrganizationInviteStatus.ACCEPTED)
        self.assertIsNotNone(invite.accepted_membership_id)
        self.assertEqual(accept_response.data["company_id"], self.organization_a.id)
        self.assertEqual(accept_response.data["membership_id"], invite.accepted_membership_id)
        self.assertTrue(accept_response.data["mfa_enrollment_required"])
        self.assertTrue(
            OrganizationAccessAuditEvent.objects.filter(
                organization=self.organization_a,
                invite=invite,
                action_type=OrganizationAccessAuditAction.INVITE_ACCEPTED,
            ).exists()
        )

    def test_password_reset_completion_updates_password_and_expires_used_tokens(self) -> None:
        target_user = make_user("reset-target@example.com", password="secret123", full_name="Reset Target")
        target_membership = add_membership(target_user, self.organization_a)
        staff_role = make_role(Role.SystemCode.STAFF)
        assign_role(target_membership, staff_role)

        password_reset = OrganizationPasswordReset.objects.create(
            organization=self.organization_a,
            membership=target_membership,
            reset_token="reset-token-123",
            issued_by="Owner User",
            expires_at=timezone.now() + timedelta(days=1),
        )
        anonymous_client = APIClient()

        complete_response = anonymous_client.post(
            reverse("compat-password-reset-complete"),
            {
                "reset_token": password_reset.reset_token,
                "password": "EvenStrongerPassword123!",
            },
            format="json",
        )

        self.assertEqual(complete_response.status_code, status.HTTP_200_OK)
        password_reset.refresh_from_db()
        target_user.refresh_from_db()
        self.assertEqual(password_reset.status, OrganizationPasswordResetStatus.COMPLETED)
        self.assertTrue(target_user.check_password("EvenStrongerPassword123!"))
        self.assertTrue(
            OrganizationAccessAuditEvent.objects.filter(
                organization=self.organization_a,
                password_reset=password_reset,
                action_type=OrganizationAccessAuditAction.PASSWORD_RESET_COMPLETED,
            ).exists()
        )

        repeat_response = anonymous_client.post(
            reverse("compat-password-reset-complete"),
            {
                "reset_token": password_reset.reset_token,
                "password": "AnotherStrongPassword123!",
            },
            format="json",
        )
        self.assertEqual(repeat_response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(repeat_response.data["reset_token"], "Reset token is no longer active")
