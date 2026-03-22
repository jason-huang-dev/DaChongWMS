from django.test import TestCase
from rest_framework.test import APIRequestFactory

from apps.iam.models import Role
from apps.organizations.permissions import CanManageOrganizationUsers

from .test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_permission,
    make_role,
    make_user,
)


class CanManageOrganizationUsersTests(TestCase):
    def test_manager_with_iam_permission_is_allowed(self):
        organization = make_organization()
        manager = make_user("manager@example.com")
        membership = add_membership(manager, organization)
        permission = make_permission("manage_memberships")
        role = make_role(Role.SystemCode.MANAGER)
        grant_role_permission(role, permission)
        assign_role(membership, role)

        request = APIRequestFactory().post("/")
        request.user = manager
        view = type("View", (), {"organization": organization})()

        self.assertTrue(CanManageOrganizationUsers().has_permission(request, view))
