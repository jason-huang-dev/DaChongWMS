from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import (
    AccessAuditAction,
    AccessAuditEvent,
    Company,
    CompanyInvite,
    CompanyInviteStatus,
    CompanyMembership,
    CompanyPasswordReset,
    CompanyPasswordResetStatus,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
)


def create_warehouse(*, openid: str, name: str) -> Warehouse:
    return Warehouse.objects.create(
        warehouse_name=name,
        warehouse_city="New York",
        warehouse_address="1 Access Way",
        warehouse_contact="555-1200",
        warehouse_manager="Access Lead",
        creator="system",
        openid=openid,
    )


class AccessApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.user = get_user_model().objects.create_user(
            username="owner",
            email="owner@example.com",
            password="StrongPassword123!",
        )
        self.company_a = Company.objects.create(
            company_name="Company A",
            company_code="company_a",
            description="Primary company",
            openid="company-a-openid",
            creator="system",
        )
        self.company_b = Company.objects.create(
            company_name="Company B",
            company_code="company_b",
            description="Secondary company",
            openid="company-b-openid",
            creator="system",
        )
        self.warehouse_a = create_warehouse(openid=self.company_a.openid, name="Company A Warehouse")
        self.warehouse_b = create_warehouse(openid=self.company_b.openid, name="Company B Warehouse")
        self.company_a.default_warehouse = self.warehouse_a
        self.company_a.save(update_fields=["default_warehouse", "update_time"])
        self.company_b.default_warehouse = self.warehouse_b
        self.company_b.save(update_fields=["default_warehouse", "update_time"])

        self.profile_a = Users.objects.create(
            user_id=self.user.id,
            name="Owner A",
            vip=1,
            openid="owner-token-a",
            appid="owner-app-a",
            t_code="owner-a",
            ip="127.0.0.1",
        )
        self.staff_a = Staff.objects.create(
            staff_name="Owner A",
            staff_type="Manager",
            check_code=1111,
            openid=self.company_a.openid,
        )
        self.membership_a = CompanyMembership.objects.create(
            company=self.company_a,
            auth_user=self.user,
            profile=self.profile_a,
            staff=self.staff_a,
            default_warehouse=self.warehouse_a,
            is_company_admin=True,
            can_manage_users=True,
            creator="Owner A",
            openid=self.company_a.openid,
        )

        self.profile_b = Users.objects.create(
            user_id=self.user.id,
            name="Owner B",
            vip=1,
            openid="owner-token-b",
            appid="owner-app-b",
            t_code="owner-b",
            ip="127.0.0.1",
        )
        self.staff_b = Staff.objects.create(
            staff_name="Owner B",
            staff_type="Supervisor",
            check_code=2222,
            openid=self.company_b.openid,
        )
        self.membership_b = CompanyMembership.objects.create(
            company=self.company_b,
            auth_user=self.user,
            profile=self.profile_b,
            staff=self.staff_b,
            default_warehouse=self.warehouse_b,
            is_company_admin=True,
            can_manage_users=True,
            creator="Owner B",
            openid=self.company_b.openid,
        )

        self.my_memberships_url = reverse("access:my-membership-list")
        self.company_memberships_url = reverse("access:company-membership-list")
        self.company_invites_url = reverse("access:company-invite-list")
        self.password_resets_url = reverse("access:password-reset-list")
        self.audit_events_url = reverse("access:audit-event-list")
        self.queue_view_preferences_url = reverse("access:queue-view-preference-list")
        self.workspace_tabs_url = reverse("access:workspace-tab-list")
        self.workbench_preference_url = reverse("access:workbench-preference-current")

    def _auth_headers(self, *, token: str, operator: Staff) -> dict[str, str]:
        return {
            "HTTP_TOKEN": token,
            "HTTP_OPERATOR": str(operator.id),
        }

    def test_my_memberships_list_uses_profile_token_authentication(self) -> None:
        response = self.client.get(
            self.my_memberships_url,
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["count"], 2)
        company_names = {row["company_name"] for row in payload["results"]}
        self.assertEqual(company_names, {"Company A", "Company B"})
        current_row = next(row for row in payload["results"] if row["id"] == self.membership_a.id)
        self.assertTrue(current_row["is_current"])

    def test_activate_membership_returns_company_scoped_auth_payload(self) -> None:
        response = self.client.post(
            reverse("access:my-membership-activate", kwargs={"pk": self.membership_b.id}),
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["openid"], self.company_b.openid)
        self.assertEqual(payload["token"], self.profile_b.openid)
        self.assertEqual(payload["user_id"], self.staff_b.id)
        self.assertEqual(payload["company_id"], self.company_b.id)
        self.assertEqual(payload["membership_id"], self.membership_b.id)
        self.assertTrue(
            AccessAuditEvent.objects.filter(
                company=self.company_b,
                membership=self.membership_b,
                action_type=AccessAuditAction.MEMBERSHIP_SWITCHED,
            ).exists()
        )

    def test_company_admin_can_provision_browser_account(self) -> None:
        response = self.client.post(
            self.company_memberships_url,
            data=json.dumps(
                {
                    "username": "picker-1",
                    "email": "picker-1@example.com",
                    "password": "StrongPassword123!",
                    "staff_name": "Picker One",
                    "staff_type": "Outbound",
                    "check_code": 6789,
                    "is_lock": False,
                    "is_company_admin": False,
                    "can_manage_users": False,
                    "default_warehouse": self.warehouse_a.id,
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 201)
        membership = CompanyMembership.objects.get(id=response.json()["id"])
        self.assertEqual(membership.company_id, self.company_a.id)
        self.assertEqual(membership.staff.staff_name, "Picker One")
        self.assertEqual(membership.staff.openid, self.company_a.openid)
        self.assertNotEqual(membership.profile.openid, self.company_a.openid)

    def test_company_admin_can_update_membership_access(self) -> None:
        response = self.client.patch(
            reverse("access:company-membership-detail", kwargs={"pk": self.membership_a.id}),
            data=json.dumps(
                {
                    "email": "owner-updated@example.com",
                    "staff_name": "Owner A Updated",
                    "staff_type": "Supervisor",
                    "check_code": 4321,
                    "is_lock": False,
                    "is_company_admin": True,
                    "can_manage_users": True,
                    "is_active": True,
                    "default_warehouse": self.warehouse_a.id,
                    "password": "",
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 200)
        self.membership_a.refresh_from_db()
        self.assertEqual(self.membership_a.staff.staff_name, "Owner A Updated")
        self.assertEqual(self.membership_a.auth_user.email, "owner-updated@example.com")
        self.assertTrue(
            AccessAuditEvent.objects.filter(
                company=self.company_a,
                membership=self.membership_a,
                action_type=AccessAuditAction.MEMBERSHIP_UPDATED,
            ).exists()
        )

    def test_company_admin_can_create_and_revoke_invite(self) -> None:
        create_response = self.client.post(
            self.company_invites_url,
            data=json.dumps(
                {
                    "email": "invitee@example.com",
                    "staff_name": "Invited User",
                    "staff_type": "Outbound",
                    "check_code": 5555,
                    "default_warehouse": self.warehouse_a.id,
                    "invite_message": "Join outbound",
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(create_response.status_code, 201)
        invite = CompanyInvite.objects.get(id=create_response.json()["id"])
        self.assertEqual(invite.status, CompanyInviteStatus.PENDING)
        self.assertTrue(invite.invite_token)

        revoke_response = self.client.post(
            reverse("access:company-invite-revoke", kwargs={"pk": invite.id}),
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(revoke_response.status_code, 200)
        invite.refresh_from_db()
        self.assertEqual(invite.status, CompanyInviteStatus.REVOKED)
        self.assertTrue(
            AccessAuditEvent.objects.filter(company=self.company_a, invite=invite, action_type=AccessAuditAction.INVITE_REVOKED).exists()
        )

    def test_invite_acceptance_creates_account_membership_and_auth_payload(self) -> None:
        invite = CompanyInvite.objects.create(
            company=self.company_a,
            email="accept@example.com",
            staff_name="Accepted User",
            staff_type="Inbound",
            check_code=4545,
            default_warehouse=self.warehouse_a,
            invite_token="accept-token",
            invited_by=self.staff_a.staff_name,
            expires_at=self.company_a.create_time.replace(year=self.company_a.create_time.year + 1),
            creator=self.staff_a.staff_name,
            openid=self.company_a.openid,
        )
        response = self.client.post(
            reverse("access:company-invite-accept"),
            data=json.dumps(
                {
                    "invite_token": invite.invite_token,
                    "username": "accepted-user",
                    "password": "StrongPassword123!",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 201)
        invite.refresh_from_db()
        self.assertEqual(invite.status, CompanyInviteStatus.ACCEPTED)
        self.assertIsNotNone(invite.accepted_membership_id)
        self.assertEqual(response.json()["company_id"], self.company_a.id)
        self.assertEqual(response.json()["membership_id"], invite.accepted_membership_id)
        self.assertTrue(
            AccessAuditEvent.objects.filter(company=self.company_a, invite=invite, action_type=AccessAuditAction.INVITE_ACCEPTED).exists()
        )

    def test_company_admin_can_issue_and_revoke_password_reset(self) -> None:
        response = self.client.post(
            self.password_resets_url,
            data=json.dumps(
                {
                    "membership": self.membership_a.id,
                    "expires_in_hours": 24,
                    "notes": "Operator requested reset",
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 201)
        password_reset = CompanyPasswordReset.objects.get(id=response.json()["id"])
        self.assertEqual(password_reset.status, CompanyPasswordResetStatus.PENDING)
        self.assertTrue(password_reset.reset_token)

        revoke_response = self.client.post(
            reverse("access:password-reset-revoke", kwargs={"pk": password_reset.id}),
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(revoke_response.status_code, 200)
        password_reset.refresh_from_db()
        self.assertEqual(password_reset.status, CompanyPasswordResetStatus.REVOKED)

    def test_password_reset_completion_updates_password_and_audit(self) -> None:
        password_reset = CompanyPasswordReset.objects.create(
            company=self.company_a,
            membership=self.membership_a,
            reset_token="reset-token",
            issued_by=self.staff_a.staff_name,
            expires_at=self.company_a.create_time.replace(year=self.company_a.create_time.year + 1),
            creator=self.staff_a.staff_name,
            openid=self.company_a.openid,
        )
        response = self.client.post(
            reverse("access:password-reset-complete"),
            data=json.dumps(
                {
                    "reset_token": password_reset.reset_token,
                    "password": "EvenStrongerPassword123!",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 200)
        password_reset.refresh_from_db()
        self.assertEqual(password_reset.status, CompanyPasswordResetStatus.COMPLETED)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("EvenStrongerPassword123!"))
        self.assertTrue(
            AccessAuditEvent.objects.filter(
                company=self.company_a,
                password_reset=password_reset,
                action_type=AccessAuditAction.PASSWORD_RESET_COMPLETED,
            ).exists()
        )

    def test_company_admin_can_view_access_audit_feed(self) -> None:
        AccessAuditEvent.objects.create(
            company=self.company_a,
            membership=self.membership_a,
            action_type=AccessAuditAction.MEMBERSHIP_UPDATED,
            actor_name=self.staff_a.staff_name,
            target_identifier=self.user.username,
            payload={"field": "email"},
            creator=self.staff_a.staff_name,
            openid=self.company_a.openid,
        )
        response = self.client.get(
            self.audit_events_url,
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(response.status_code, 200)
        self.assertGreaterEqual(response.json()["count"], 1)

    def test_operator_can_create_and_update_queue_view_preference(self) -> None:
        create_response = self.client.post(
            self.queue_view_preferences_url,
            data=json.dumps(
                {
                    "route_key": "outbound.sales-orders",
                    "name": "Open today",
                    "status_bucket": "OPEN",
                    "search_scope": "order_number",
                    "filter_payload": {"status": "OPEN", "requested_ship_date__gte": "2026-03-01"},
                    "visible_columns": ["order_number", "customer_name", "status"],
                    "page_size": 50,
                    "density": "COMPACT",
                    "warehouse": self.warehouse_a.id,
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(create_response.status_code, 201)
        preference = QueueViewPreference.objects.get(id=create_response.json()["id"])
        self.assertEqual(preference.route_key, "outbound.sales-orders")
        self.assertEqual(preference.warehouse_id, self.warehouse_a.id)

        patch_response = self.client.patch(
            reverse("access:queue-view-preference-detail", kwargs={"pk": preference.id}),
            data=json.dumps({"is_default": True, "name": "Open today default"}),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(patch_response.status_code, 200)
        preference.refresh_from_db()
        self.assertTrue(preference.is_default)
        self.assertEqual(preference.name, "Open today default")

    def test_operator_can_sync_activate_and_close_workspace_tabs(self) -> None:
        sync_response = self.client.post(
            reverse("access:workspace-tab-sync"),
            data=json.dumps(
                {
                    "route_key": "outbound",
                    "route_path": "/outbound",
                    "title": "Outbound",
                    "icon_key": "LocalShippingOutlined",
                    "is_active": True,
                    "state_payload": {"status_bucket": "OPEN"},
                    "context_payload": {"warehouse_id": self.warehouse_a.id},
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(sync_response.status_code, 200)
        outbound_tab = WorkspaceTabPreference.objects.get(id=sync_response.json()["id"])
        self.assertTrue(outbound_tab.is_active)

        second_sync = self.client.post(
            reverse("access:workspace-tab-sync"),
            data=json.dumps(
                {
                    "route_key": "dashboard",
                    "route_path": "/dashboard",
                    "title": "Dashboard",
                    "icon_key": "DashboardOutlined",
                    "is_active": True,
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(second_sync.status_code, 200)
        outbound_tab.refresh_from_db()
        self.assertFalse(outbound_tab.is_active)

        activate_response = self.client.post(
            reverse("access:workspace-tab-activate", kwargs={"pk": outbound_tab.id}),
            data=json.dumps({}),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(activate_response.status_code, 200)
        outbound_tab.refresh_from_db()
        self.assertTrue(outbound_tab.is_active)

        delete_response = self.client.delete(
            reverse("access:workspace-tab-detail", kwargs={"pk": outbound_tab.id}),
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(delete_response.status_code, 204)
        outbound_tab.refresh_from_db()
        self.assertTrue(outbound_tab.is_delete)

    def test_operator_can_get_and_update_workbench_preference(self) -> None:
        get_response = self.client.get(
            self.workbench_preference_url,
            {"page_key": "dashboard"},
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(get_response.status_code, 200)
        preference = WorkbenchPreference.objects.get(id=get_response.json()["id"])
        self.assertEqual(preference.page_key, "dashboard")

        patch_response = self.client.patch(
            self.workbench_preference_url,
            data=json.dumps(
                {
                    "page_key": "dashboard",
                    "time_window": "MONTH",
                    "visible_widget_keys": ["ops-summary", "counts", "exceptions"],
                    "right_rail_widget_keys": ["notices", "contacts"],
                    "layout_payload": {"dense_mode": True},
                }
            ),
            content_type="application/json",
            **self._auth_headers(token=self.profile_a.openid, operator=self.staff_a),
        )
        self.assertEqual(patch_response.status_code, 200)
        preference.refresh_from_db()
        self.assertEqual(preference.time_window, "MONTH")
        self.assertEqual(preference.layout_payload["dense_mode"], True)
