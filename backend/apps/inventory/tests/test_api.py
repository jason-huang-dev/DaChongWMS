from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_type,
    create_zone,
)
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_role,
    make_user,
)
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InventoryAPITests(TestCase):
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
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Scanner",
        )
        zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="BULK",
                name="Bulk",
            )
        )
        self.location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code="A-01-01",
            )
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_inventory", "manage_inventory_records", "manage_inventory_configuration"):
            permission = Permission.objects.get(
                content_type__app_label="inventory",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="inventory",
            codename="view_inventory",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_record_inventory_and_configure_adjustments(self) -> None:
        self.client.force_authenticate(self.manager)

        movement_response = self.client.post(
            reverse(
                "organization-inventory-movement-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "product_id": self.product.id,
                "to_location_id": self.location.id,
                "movement_type": "RECEIPT",
                "stock_status": "AVAILABLE",
                "quantity": "8.0000",
                "unit_cost": "3.2500",
                "currency": "usd",
                "reason": "Inbound receipt",
            },
            format="json",
        )
        self.assertEqual(movement_response.status_code, status.HTTP_201_CREATED)

        balances_response = self.client.get(
            reverse(
                "organization-inventory-balance-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        self.assertEqual(balances_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(balances_response.data), 1)

        reason_response = self.client.post(
            reverse(
                "organization-inventory-adjustment-reason-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "code": "damage",
                "name": "Damage",
                "description": "Damage write-off",
                "direction": "DECREASE",
                "requires_approval": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(reason_response.status_code, status.HTTP_201_CREATED)

    def test_viewer_can_list_balances_but_cannot_record_inventory(self) -> None:
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse(
                "organization-inventory-balance-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        create_response = self.client.post(
            reverse(
                "organization-inventory-movement-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "product_id": self.product.id,
                "to_location_id": self.location.id,
                "movement_type": "RECEIPT",
                "stock_status": "AVAILABLE",
                "quantity": "1.0000",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
