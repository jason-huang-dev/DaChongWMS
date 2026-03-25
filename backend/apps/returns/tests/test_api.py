from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.inventory.models import InventoryBalance, InventoryStatus
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
from apps.products.models import Product
from apps.returns.models import ReturnOrder, ReturnOrderStatus
from apps.warehouse.models import Warehouse


class ReturnsAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("returns-manager@example.com")
        self.operator = make_user("returns-operator@example.com")
        self.viewer = make_user("returns-viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.operator_membership = add_membership(self.operator, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Returns Warehouse",
            code="RT-WH",
        )
        returns_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="RET",
                name="Returns",
                usage=ZoneUsage.RETURNS,
            )
        )
        quarantine_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="QUA",
                name="Quarantine",
                usage=ZoneUsage.QUARANTINE,
                sequence=10,
            )
        )
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STO",
                name="Storage",
                usage=ZoneUsage.STORAGE,
                sequence=20,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="STD",
                name="Standard",
            )
        )
        self.returns_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=returns_zone,
                location_type=location_type,
                code="RET-01",
                barcode="RET-01",
                is_pick_face=False,
            )
        )
        self.quarantine_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=quarantine_zone,
                location_type=location_type,
                code="QUA-01",
                barcode="QUA-01",
                is_pick_face=False,
            )
        )
        self.storage_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=storage_zone,
                location_type=location_type,
                code="STO-01",
                barcode="STO-01",
                is_pick_face=True,
            )
        )
        self.customer_account = make_customer_account(
            self.organization,
            name="Returns Client",
            code="RET-CLIENT",
            billing_email="billing@returns.test",
        )
        self.customer_account.contact_name = "Returns Ops"
        self.customer_account.contact_email = "ops@returns.test"
        self.customer_account.contact_phone = "555-0140"
        self.customer_account.save()
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-RET-001",
            barcode="BC-RET-001",
            name="Returned Widget",
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_returns", "manage_return_orders", "manage_return_execution"):
            permission = Permission.objects.get(content_type__app_label="returns", codename=codename)
            grant_role_permission(manager_role, permission)

        for codename in ("view_returns", "manage_return_execution"):
            permission = Permission.objects.get(content_type__app_label="returns", codename=codename)
            grant_role_permission(staff_role, permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.operator_membership, staff_role)
        assign_role(self.viewer_membership, staff_role)

    def _create_return_order(self, return_number: str = "RMA-1001") -> int:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse("organization-return-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "return_number": return_number,
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "expected_qty": "2.0000",
                        "return_reason": "Damaged carton",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return int(response.data["id"])

    def test_return_order_captures_customer_snapshot(self) -> None:
        return_order_id = self._create_return_order()
        return_order = ReturnOrder.objects.get(pk=return_order_id)

        self.assertEqual(return_order.customer_account_id, self.customer_account.id)
        self.assertEqual(return_order.customer_code, self.customer_account.code)
        self.assertEqual(return_order.customer_name, self.customer_account.name)
        self.assertEqual(return_order.customer_contact_name, self.customer_account.contact_name)
        self.assertEqual(return_order.customer_contact_email, self.customer_account.contact_email)
        self.assertEqual(return_order.customer_contact_phone, self.customer_account.contact_phone)

    def test_receipt_and_restock_disposition_update_inventory(self) -> None:
        return_order_id = self._create_return_order(return_number="RMA-2001")
        return_order = ReturnOrder.objects.get(pk=return_order_id)
        return_line = return_order.lines.get()

        self.client.force_authenticate(self.operator)
        receipt_response = self.client.post(
            reverse("organization-return-receipt-list", kwargs={"organization_id": self.organization.id}),
            {
                "return_line_id": return_line.id,
                "warehouse_id": self.warehouse.id,
                "receipt_location_id": self.returns_location.id,
                "receipt_number": "RTRC-2001",
                "received_qty": "2.0000",
                "stock_status": InventoryStatus.AVAILABLE,
            },
            format="json",
        )
        self.assertEqual(receipt_response.status_code, status.HTTP_201_CREATED)

        return_order.refresh_from_db()
        returns_balance = InventoryBalance.objects.get(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.returns_location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
        )
        self.assertEqual(return_order.status, ReturnOrderStatus.RECEIVED)
        self.assertEqual(returns_balance.on_hand_qty, Decimal("2.0000"))

        disposition_response = self.client.post(
            reverse("organization-return-disposition-list", kwargs={"organization_id": self.organization.id}),
            {
                "return_receipt_id": receipt_response.data["id"],
                "warehouse_id": self.warehouse.id,
                "disposition_number": "RTDP-2001",
                "disposition_type": "RESTOCK",
                "quantity": "2.0000",
                "to_location_id": self.storage_location.id,
            },
            format="json",
        )
        self.assertEqual(disposition_response.status_code, status.HTTP_201_CREATED)

        return_order.refresh_from_db()
        returns_balance.refresh_from_db()
        storage_balance = InventoryBalance.objects.get(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.storage_location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
        )
        self.assertEqual(return_order.status, ReturnOrderStatus.COMPLETED)
        self.assertEqual(returns_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(storage_balance.on_hand_qty, Decimal("2.0000"))

    def test_viewer_can_list_return_orders_but_cannot_create(self) -> None:
        self._create_return_order(return_number="RMA-3001")

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get(
            reverse("organization-return-order-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-return-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "return_number": "RMA-3002",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "expected_qty": "1.0000",
                    }
                ],
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

