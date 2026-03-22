from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_role,
    make_user,
)
from apps.warehouse.models import Warehouse


class WarehouseAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.viewer = make_user("viewer@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_warehouse", "add_warehouse", "change_warehouse"):
            permission = Permission.objects.get(
                content_type__app_label="warehouse",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="warehouse",
            codename="view_warehouse",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_create_warehouse(self) -> None:
        self.client.force_authenticate(self.manager)

        response = self.client.post(
            reverse(
                "organization-warehouse-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {"name": "Primary", "code": "wh-a", "is_active": True},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["code"], "WH-A")

    def test_viewer_can_list_but_cannot_create(self) -> None:
        Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse(
                "organization-warehouse-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        create_response = self.client.post(
            reverse(
                "organization-warehouse-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {"name": "Overflow", "code": "WH-B", "is_active": True},
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
