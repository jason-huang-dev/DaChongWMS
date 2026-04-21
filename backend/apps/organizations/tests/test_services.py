from django.test import TestCase

from apps.iam.models import Role
from apps.organizations.models import MembershipType
from apps.organizations.services.membership_service import (
    CreateOrganizationUserInput,
    MembershipError,
    create_organization_user,
)

from .test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_permission,
    make_role,
    make_user,
    make_customer_account,
)
from apps.partners.services.customer_accounts import grant_client_account_access


class CreateOrganizationUserServiceTests(TestCase):
    def setUp(self):
        self.organization = make_organization()
        self.customer_account = make_customer_account(self.organization)
        self.owner = make_user("owner@example.com")
        self.client_admin = make_user("client-admin@example.com")

        self.manage_memberships = make_permission("manage_memberships")
        self.manage_client_users = make_permission("manage_client_users")

        self.owner_role = make_role(Role.SystemCode.OWNER)
        self.client_admin_role = make_role(
            Role.SystemCode.CLIENT_ADMIN,
            membership_type=MembershipType.CLIENT,
        )
        self.client_user_role = make_role(
            Role.SystemCode.CLIENT_USER,
            membership_type=MembershipType.CLIENT,
        )
        self.manager_role = make_role(Role.SystemCode.MANAGER)

        grant_role_permission(self.owner_role, self.manage_memberships)
        grant_role_permission(self.client_admin_role, self.manage_client_users)

        self.owner_membership = add_membership(self.owner, self.organization)
        self.client_admin_membership = add_membership(
            self.client_admin,
            self.organization,
            membership_type=MembershipType.CLIENT,
        )

        assign_role(self.owner_membership, self.owner_role)
        grant_client_account_access(
            membership=self.client_admin_membership,
            customer_account=self.customer_account,
            role_code=Role.SystemCode.CLIENT_ADMIN,
        )

    def test_owner_can_create_manager(self):
        membership, user_created = create_organization_user(
            CreateOrganizationUserInput(
                actor=self.owner,
                organization=self.organization,
                email="newmanager@example.com",
                full_name="New Manager",
                membership_type=MembershipType.INTERNAL,
                role_code=Role.SystemCode.MANAGER,
            )
        )

        self.assertTrue(user_created)
        self.assertEqual(membership.membership_type, MembershipType.INTERNAL)
        self.assertEqual(
            list(membership.role_assignments.values_list("role__code", flat=True)),
            [Role.SystemCode.MANAGER],
        )

    def test_client_admin_can_create_client_user(self):
        membership, user_created = create_organization_user(
            CreateOrganizationUserInput(
                actor=self.client_admin,
                organization=self.organization,
                email="client-user@example.com",
                full_name="Client User",
                membership_type=MembershipType.CLIENT,
                role_code=Role.SystemCode.CLIENT_USER,
                customer_account_id=self.customer_account.id,
            )
        )

        self.assertTrue(user_created)
        self.assertEqual(membership.membership_type, MembershipType.CLIENT)
        self.assertEqual(
            list(membership.role_assignments.values_list("role__code", flat=True)),
            [Role.SystemCode.CLIENT_USER],
        )
        self.assertEqual(
            list(membership.client_account_accesses.values_list("customer_account_id", flat=True)),
            [self.customer_account.id],
        )

    def test_client_admin_cannot_create_internal_user(self):
        with self.assertRaises(MembershipError):
            create_organization_user(
                CreateOrganizationUserInput(
                    actor=self.client_admin,
                    organization=self.organization,
                    email="staff@example.com",
                    full_name="Internal Staff",
                    membership_type=MembershipType.INTERNAL,
                    role_code=Role.SystemCode.MANAGER,
                )
            )

    def test_manager_cannot_create_owner(self):
        manager = make_user("manager2@example.com")
        manager_membership = add_membership(manager, self.organization)
        assign_role(manager_membership, self.manager_role)

        with self.assertRaises(MembershipError):
            create_organization_user(
                CreateOrganizationUserInput(
                    actor=manager,
                    organization=self.organization,
                    email="promoted-owner@example.com",
                    full_name="Promoted Owner",
                    membership_type=MembershipType.INTERNAL,
                    role_code=Role.SystemCode.OWNER,
                )
            )

    def test_client_user_requires_customer_account(self):
        with self.assertRaises(MembershipError):
            create_organization_user(
                CreateOrganizationUserInput(
                    actor=self.owner,
                    organization=self.organization,
                    email="client2@example.com",
                    full_name="Client User",
                    membership_type=MembershipType.CLIENT,
                )
            )
