from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.locations.models import Location
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_role,
    make_user,
)
from apps.warehouse.models import Warehouse


class LocationsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.viewer = make_user("viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_locations", "manage_location_topology", "manage_location_locks"):
            permission = Permission.objects.get(
                content_type__app_label="locations",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="locations",
            codename="view_locations",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_create_location_topology_and_lock(self) -> None:
        self.client.force_authenticate(self.manager)

        zone_response = self.client.post(
            reverse("organization-zone-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "code": "recv",
                "name": "Receiving",
                "usage": "RECEIVING",
                "sequence": 1,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(zone_response.status_code, status.HTTP_201_CREATED)

        location_type_response = self.client.post(
            reverse("organization-location-type-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "pick",
                "name": "Pick Face",
                "picking_enabled": True,
                "putaway_enabled": True,
                "allow_mixed_sku": False,
                "max_weight": "50.00",
                "max_volume": "2.0000",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(location_type_response.status_code, status.HTTP_201_CREATED)

        location_response = self.client.post(
            reverse("organization-location-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "zone_id": zone_response.data["id"],
                "location_type_id": location_type_response.data["id"],
                "code": "A-01-01",
                "pick_sequence": 10,
                "status": "AVAILABLE",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(location_response.status_code, status.HTTP_201_CREATED)

        lock_response = self.client.post(
            reverse("organization-location-lock-list", kwargs={"organization_id": self.organization.id}),
            {
                "location_id": location_response.data["id"],
                "reason": "Maintenance",
                "notes": "Forklift aisle blocked",
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(lock_response.status_code, status.HTTP_201_CREATED)

        location = Location.objects.get(pk=location_response.data["id"])
        self.assertTrue(location.is_locked)

    def test_viewer_can_list_locations_but_cannot_create(self) -> None:
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse("organization-location-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-location-type-list", kwargs={"organization_id": self.organization.id}),
            {
                "code": "bulk",
                "name": "Bulk",
                "picking_enabled": True,
                "putaway_enabled": True,
                "allow_mixed_sku": True,
                "max_weight": "100.00",
                "max_volume": "4.0000",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
