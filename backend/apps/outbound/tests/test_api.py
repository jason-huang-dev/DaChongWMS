from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.operation_types import OperationOrderType
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
    make_customer_account,
    make_organization,
    make_role,
    make_user,
)
from apps.outbound.models import PickTask, PickTaskStatus, SalesOrder, SalesOrderFulfillmentStage, SalesOrderStatus
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class OutboundAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.operator = make_user("operator@example.com")
        self.viewer = make_user("viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.operator_membership = add_membership(self.operator, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )
        picking_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="PICK",
                name="Picking",
                usage=ZoneUsage.PICKING,
            )
        )
        shipping_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="SHIP",
                name="Shipping",
                usage=ZoneUsage.SHIPPING,
                sequence=10,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="PICKFACE",
                name="Pick Face",
            )
        )
        self.pick_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=picking_zone,
                location_type=location_type,
                code="PICK-01",
                barcode="PICK-01",
                is_pick_face=True,
            )
        )
        self.staging_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=shipping_zone,
                location_type=location_type,
                code="SHIP-01",
                barcode="SHIP-01",
                is_pick_face=False,
            )
        )
        self.customer_account = make_customer_account(
            self.organization,
            name="Acme Retail",
            code="ACME",
            billing_email="billing@acme.test",
        )
        self.customer_account.contact_name = "Acme Ops"
        self.customer_account.contact_email = "ops@acme.test"
        self.customer_account.contact_phone = "555-0100"
        self.customer_account.shipping_method = "Express"
        self.customer_account.save()
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-OUT-001",
            barcode="BC-OUT-001",
            name="Scanner",
        )
        self.source_balance = InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.pick_location,
            product=self.product,
            stock_status="AVAILABLE",
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            currency="USD",
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_outbound", "manage_outbound_orders", "manage_outbound_execution"):
            permission = Permission.objects.get(content_type__app_label="outbound", codename=codename)
            grant_role_permission(manager_role, permission)

        for codename in ("view_outbound", "manage_outbound_execution"):
            permission = Permission.objects.get(content_type__app_label="outbound", codename=codename)
            grant_role_permission(staff_role, permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.operator_membership, staff_role)
        assign_role(self.viewer_membership, staff_role)

    def _create_order(self, order_number: str = "SO-1001") -> int:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse("organization-sales-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "staging_location_id": self.staging_location.id,
                "order_type": OperationOrderType.DROPSHIP,
                "order_number": order_number,
                "receiver_name": "Client Receiver",
                "receiver_phone": "555-7700",
                "receiver_country": "US",
                "receiver_state": "NY",
                "receiver_city": "New York",
                "receiver_address": "1 Customer Plaza",
                "receiver_postal_code": "10001",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "ordered_qty": "4.0000",
                        "unit_price": "9.5000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return int(response.data["id"])

    def test_dropship_order_captures_customer_account_snapshot(self) -> None:
        order_id = self._create_order()
        order = SalesOrder.objects.get(pk=order_id)

        self.assertEqual(order.order_type, OperationOrderType.DROPSHIP)
        self.assertEqual(order.customer_account_id, self.customer_account.id)
        self.assertEqual(order.customer_code, self.customer_account.code)
        self.assertEqual(order.customer_name, self.customer_account.name)
        self.assertEqual(order.customer_contact_name, self.customer_account.contact_name)
        self.assertEqual(order.customer_contact_email, self.customer_account.contact_email)
        self.assertEqual(order.customer_contact_phone, self.customer_account.contact_phone)

    def test_allocate_pick_and_ship_updates_inventory(self) -> None:
        order_id = self._create_order(order_number="SO-2001")
        self.client.force_authenticate(self.manager)

        allocate_response = self.client.post(
            reverse(
                "organization-sales-order-allocate",
                kwargs={"organization_id": self.organization.id, "sales_order_id": order_id},
            ),
            {},
            format="json",
        )
        self.assertEqual(allocate_response.status_code, status.HTTP_200_OK)

        order = SalesOrder.objects.get(pk=order_id)
        task = PickTask.objects.get(sales_order_line=order.lines.get())
        self.source_balance.refresh_from_db()
        self.assertEqual(order.status, SalesOrderStatus.ALLOCATED)
        self.assertEqual(order.fulfillment_stage, SalesOrderFulfillmentStage.IN_PROCESS)
        self.assertEqual(task.status, PickTaskStatus.OPEN)
        self.assertEqual(self.source_balance.allocated_qty, Decimal("4.0000"))

        self.client.force_authenticate(self.operator)
        pick_response = self.client.post(
            reverse(
                "organization-pick-task-complete",
                kwargs={"organization_id": self.organization.id, "pick_task_id": task.id},
            ),
            {"to_location_id": self.staging_location.id},
            format="json",
        )
        self.assertEqual(pick_response.status_code, status.HTTP_200_OK)

        order.refresh_from_db()
        self.source_balance.refresh_from_db()
        staging_balance = InventoryBalance.objects.get(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.staging_location,
            product=self.product,
            stock_status="AVAILABLE",
        )
        self.assertEqual(order.status, SalesOrderStatus.PICKED)
        self.assertEqual(self.source_balance.on_hand_qty, Decimal("6.0000"))
        self.assertEqual(self.source_balance.allocated_qty, Decimal("0.0000"))
        self.assertEqual(staging_balance.on_hand_qty, Decimal("4.0000"))

        self.client.force_authenticate(self.manager)
        ship_response = self.client.post(
            reverse(
                "organization-sales-order-ship",
                kwargs={"organization_id": self.organization.id, "sales_order_id": order.id},
            ),
            {"shipment_number": "SHIP-2001"},
            format="json",
        )
        self.assertEqual(ship_response.status_code, status.HTTP_201_CREATED)

        order.refresh_from_db()
        staging_balance.refresh_from_db()
        self.assertEqual(order.status, SalesOrderStatus.SHIPPED)
        self.assertEqual(order.fulfillment_stage, SalesOrderFulfillmentStage.SHIPPED)
        self.assertEqual(staging_balance.on_hand_qty, Decimal("0.0000"))

    def test_viewer_can_list_orders_but_cannot_create(self) -> None:
        self._create_order(order_number="SO-3001")

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get(
            reverse("organization-sales-order-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-sales-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "staging_location_id": self.staging_location.id,
                "order_type": OperationOrderType.DROPSHIP,
                "order_number": "SO-3002",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "ordered_qty": "1.0000",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
