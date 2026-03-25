from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.inventory.models import InventoryBalance
from apps.locations.models import ZoneUsage
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
from apps.transfers.models import ReplenishmentTask, TransferOrder
from apps.warehouse.models import Warehouse


class TransfersAPITests(TestCase):
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
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
                usage=ZoneUsage.STORAGE,
            )
        )
        picking_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="PICK",
                name="Picking",
                usage=ZoneUsage.PICKING,
                sequence=10,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="BULK",
                name="Bulk",
            )
        )
        self.from_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=storage_zone,
                location_type=location_type,
                code="BULK-01",
            )
        )
        self.to_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=picking_zone,
                location_type=location_type,
                code="PICK-01",
                is_pick_face=True,
            )
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Scanner",
        )
        InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.from_location,
            product=self.product,
            stock_status="AVAILABLE",
            on_hand_qty=Decimal("20.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
        )
        InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.to_location,
            product=self.product,
            stock_status="AVAILABLE",
            on_hand_qty=Decimal("2.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_transfers", "manage_transfer_orders", "manage_replenishment"):
            permission = Permission.objects.get(
                content_type__app_label="transfers",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="transfers",
            codename="view_transfers",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_create_transfer_order_and_generate_replenishment_task(self) -> None:
        self.client.force_authenticate(self.manager)

        transfer_response = self.client.post(
            reverse("organization-transfer-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "transfer_number": "TR-1001",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "from_location_id": self.from_location.id,
                        "to_location_id": self.to_location.id,
                        "requested_qty": "5.0000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(transfer_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(TransferOrder.objects.count(), 1)

        rule_response = self.client.post(
            reverse("organization-replenishment-rule-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "product_id": self.product.id,
                "source_location_id": self.from_location.id,
                "target_location_id": self.to_location.id,
                "minimum_qty": "5.0000",
                "target_qty": "10.0000",
                "stock_status": "AVAILABLE",
                "priority": 100,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(rule_response.status_code, status.HTTP_201_CREATED)

        task_response = self.client.post(
            reverse(
                "organization-replenishment-rule-generate-task",
                kwargs={
                    "organization_id": self.organization.id,
                    "replenishment_rule_id": rule_response.data["id"],
                },
            ),
            {"assigned_membership_id": self.manager_membership.id},
            format="json",
        )
        self.assertEqual(task_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(ReplenishmentTask.objects.count(), 1)

    def test_viewer_can_list_but_cannot_create_transfer_order(self) -> None:
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse("organization-transfer-order-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-transfer-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "transfer_number": "TR-1002",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "from_location_id": self.from_location.id,
                        "to_location_id": self.to_location.id,
                        "requested_qty": "1.0000",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
