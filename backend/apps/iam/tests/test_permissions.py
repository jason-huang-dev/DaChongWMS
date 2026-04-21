from django.test import TestCase

from apps.iam.constants import PermissionCode
from apps.iam.models import AccessScope, PermissionOverride, Role, RoleAssignment, RolePermission
from apps.iam.permissions import membership_has_permission, membership_permission_codes
from apps.iam.services.bootstrap import sync_system_roles
from apps.organizations.tests.test_factories import (
    add_membership,
    make_organization,
    make_permission,
    make_role,
    make_user,
)


class MembershipPermissionResolutionTests(TestCase):
    def setUp(self):
        self.organization = make_organization()
        self.user = make_user("worker@example.com")
        self.membership = add_membership(self.user, self.organization)
        self.permission = make_permission(
            "view_inventory",
            app_label="inventory",
            model="inventoryitem",
        )

    def test_org_wide_role_grants_permission(self):
        role = make_role(Role.SystemCode.STAFF)
        RolePermission.objects.create(role=role, permission=self.permission)
        RoleAssignment.objects.create(membership=self.membership, role=role)

        self.assertTrue(
            membership_has_permission(
                self.membership,
                "inventory.view_inventory",
            )
        )

    def test_scoped_role_only_grants_for_matching_scope(self):
        role = make_role(Role.SystemCode.STAFF)
        RolePermission.objects.create(role=role, permission=self.permission)
        warehouse_scope = AccessScope.objects.create(
            organization=self.organization,
            scope_type=AccessScope.ScopeType.RESOURCE,
            resource_type="warehouse",
            resource_key="warehouse-a",
            name="Warehouse A",
        )
        other_scope = AccessScope.objects.create(
            organization=self.organization,
            scope_type=AccessScope.ScopeType.RESOURCE,
            resource_type="warehouse",
            resource_key="warehouse-b",
            name="Warehouse B",
        )
        RoleAssignment.objects.create(
            membership=self.membership,
            role=role,
            scope=warehouse_scope,
        )

        self.assertTrue(
            membership_has_permission(
                self.membership,
                "inventory.view_inventory",
                scope=warehouse_scope,
            )
        )
        self.assertFalse(
            membership_has_permission(
                self.membership,
                "inventory.view_inventory",
                scope=other_scope,
            )
        )

    def test_deny_override_beats_role_grant(self):
        role = make_role(Role.SystemCode.STAFF)
        RolePermission.objects.create(role=role, permission=self.permission)
        RoleAssignment.objects.create(membership=self.membership, role=role)
        PermissionOverride.objects.create(
            membership=self.membership,
            permission=self.permission,
            effect=PermissionOverride.Effect.DENY,
        )

        self.assertFalse(
            membership_has_permission(
                self.membership,
                "inventory.view_inventory",
            )
        )

    def test_allow_override_can_grant_without_role(self):
        PermissionOverride.objects.create(
            membership=self.membership,
            permission=self.permission,
            effect=PermissionOverride.Effect.ALLOW,
        )

        self.assertTrue(
            membership_has_permission(
                self.membership,
                "inventory.view_inventory",
            )
        )

    def test_system_role_without_materialized_permissions_does_not_grant_access(self):
        owner_role = make_role(Role.SystemCode.OWNER, name="Owner")
        RoleAssignment.objects.create(membership=self.membership, role=owner_role)

        self.assertFalse(
            membership_has_permission(
                self.membership,
                PermissionCode.VIEW_INBOUND,
            )
        )
        self.assertNotIn(
            PermissionCode.VIEW_INBOUND,
            membership_permission_codes(self.membership),
        )

    def test_sync_system_roles_materializes_owner_permissions(self):
        owner_role = make_role(Role.SystemCode.OWNER, name="Owner")
        RoleAssignment.objects.create(membership=self.membership, role=owner_role)

        sync_system_roles()

        self.assertTrue(
            membership_has_permission(
                self.membership,
                PermissionCode.VIEW_INBOUND,
            )
        )
        self.assertIn(
            PermissionCode.VIEW_INBOUND,
            membership_permission_codes(self.membership),
        )
