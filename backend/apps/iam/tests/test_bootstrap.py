from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase

from apps.iam.constants import PermissionCode
from apps.iam.models import Role, RoleAssignment
from apps.organizations.tests.test_factories import add_membership, make_organization, make_role, make_user
from apps.iam.services.bootstrap import sync_system_roles


class SyncSystemRolesTests(TestCase):
    def test_sync_creates_owner_role_with_expected_permissions(self) -> None:
        sync_system_roles()

        owner_role = Role.objects.get(code=Role.SystemCode.OWNER, organization__isnull=True)
        permission_codes = {
            f"{app_label}.{codename}"
            for app_label, codename in Permission.objects.filter(
                role_permissions__role=owner_role
            ).values_list("content_type__app_label", "codename")
        }

        self.assertIn(PermissionCode.MANAGE_MEMBERSHIPS, permission_codes)
        self.assertIn(PermissionCode.ADD_WAREHOUSE, permission_codes)
        self.assertIn(PermissionCode.MANAGE_WORK_ORDERS, permission_codes)

    def test_sync_rebinds_legacy_owner_assignments_to_canonical_system_role(self) -> None:
        organization = make_organization()
        user = make_user("owner@example.com")
        membership = add_membership(user, organization)
        legacy_owner_role = make_role(
            Role.SystemCode.OWNER,
            name="Owner",
            organization=organization,
            is_system=False,
        )
        RoleAssignment.objects.create(membership=membership, role=legacy_owner_role)

        sync_system_roles()

        owner_role = Role.objects.get(code=Role.SystemCode.OWNER, organization__isnull=True)
        self.assertTrue(
            RoleAssignment.objects.filter(
                membership=membership,
                role=owner_role,
                scope__isnull=True,
            ).exists()
        )
        self.assertFalse(
            RoleAssignment.objects.filter(
                membership=membership,
                role=legacy_owner_role,
            ).exists()
        )
