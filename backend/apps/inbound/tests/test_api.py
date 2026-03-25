from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.inbound.models import AdvanceShipmentNotice, PurchaseOrder, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus
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
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InboundAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("inbound-manager@example.com")
        self.operator = make_user("inbound-operator@example.com")
        self.viewer = make_user("inbound-viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.operator_membership = add_membership(self.operator, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Inbound Warehouse",
            code="IB-WH",
        )
        receiving_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="RCV",
                name="Receiving",
                usage=ZoneUsage.RECEIVING,
            )
        )
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STO",
                name="Storage",
                usage=ZoneUsage.STORAGE,
                sequence=10,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="STD",
                name="Standard",
            )
        )
        self.receipt_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=receiving_zone,
                location_type=location_type,
                code="RCV-01",
                barcode="RCV-01",
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
            name="Inbound Client",
            code="INB-1",
            billing_email="billing@inbound.test",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-IN-001",
            barcode="BC-IN-001",
            name="Inbound Widget",
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_inbound", "manage_inbound_orders", "manage_inbound_execution"):
            permission = Permission.objects.get(content_type__app_label="inbound", codename=codename)
            grant_role_permission(manager_role, permission)

        for codename in ("view_inbound", "manage_inbound_execution"):
            permission = Permission.objects.get(content_type__app_label="inbound", codename=codename)
            grant_role_permission(staff_role, permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.operator_membership, staff_role)
        assign_role(self.viewer_membership, staff_role)

    def _create_purchase_order(self, po_number: str = "PO-1001") -> int:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse("organization-purchase-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "po_number": po_number,
                "supplier_code": "SUP-1",
                "supplier_name": "Supplier Co",
                "supplier_contact_name": "Dock Lead",
                "supplier_contact_phone": "555-0110",
                "line_items": [
                    {
                        "line_number": 1,
                        "product_id": self.product.id,
                        "ordered_qty": "5.0000",
                        "unit_cost": "3.5000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return int(response.data["id"])

    def test_purchase_order_captures_customer_and_supplier_snapshot(self) -> None:
        purchase_order_id = self._create_purchase_order()
        purchase_order = PurchaseOrder.objects.get(pk=purchase_order_id)

        self.assertEqual(purchase_order.customer_account_id, self.customer_account.id)
        self.assertEqual(purchase_order.customer_code, self.customer_account.code)
        self.assertEqual(purchase_order.customer_name, self.customer_account.name)
        self.assertEqual(purchase_order.supplier_code, "SUP-1")
        self.assertEqual(purchase_order.supplier_name, "Supplier Co")
        self.assertEqual(purchase_order.supplier_contact_name, "Dock Lead")
        self.assertEqual(purchase_order.supplier_contact_phone, "555-0110")

    def test_asn_receipt_and_putaway_update_inventory(self) -> None:
        purchase_order_id = self._create_purchase_order(po_number="PO-2001")
        purchase_order = PurchaseOrder.objects.get(pk=purchase_order_id)
        purchase_order_line = purchase_order.lines.get()

        self.client.force_authenticate(self.manager)
        asn_response = self.client.post(
            reverse("organization-asn-list", kwargs={"organization_id": self.organization.id}),
            {
                "purchase_order_id": purchase_order.id,
                "asn_number": "ASN-2001",
                "line_items": [
                    {
                        "line_number": 1,
                        "purchase_order_line_id": purchase_order_line.id,
                        "expected_qty": "5.0000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(asn_response.status_code, status.HTTP_201_CREATED)
        asn = AdvanceShipmentNotice.objects.get(pk=asn_response.data["id"])
        asn_line = asn.lines.get()

        self.client.force_authenticate(self.operator)
        receipt_response = self.client.post(
            reverse("organization-receipt-list", kwargs={"organization_id": self.organization.id}),
            {
                "asn_id": asn.id,
                "purchase_order_id": purchase_order.id,
                "warehouse_id": self.warehouse.id,
                "receipt_location_id": self.receipt_location.id,
                "receipt_number": "RCPT-2001",
                "line_items": [
                    {
                        "purchase_order_line_id": purchase_order_line.id,
                        "asn_line_id": asn_line.id,
                        "received_qty": "5.0000",
                        "unit_cost": "3.5000",
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(receipt_response.status_code, status.HTTP_201_CREATED)

        purchase_order.refresh_from_db()
        asn.refresh_from_db()
        receipt_balance = InventoryBalance.objects.get(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.receipt_location,
            product=self.product,
            stock_status="AVAILABLE",
        )
        task = PutawayTask.objects.get(receipt_line__receipt_id=receipt_response.data["id"])
        self.assertEqual(purchase_order.status, PurchaseOrderStatus.CLOSED)
        self.assertEqual(asn.status, "RECEIVED")
        self.assertEqual(task.status, PutawayTaskStatus.OPEN)
        self.assertEqual(receipt_balance.on_hand_qty, Decimal("5.0000"))

        putaway_response = self.client.post(
            reverse(
                "organization-putaway-task-complete",
                kwargs={"organization_id": self.organization.id, "putaway_task_id": task.id},
            ),
            {"to_location_id": self.storage_location.id},
            format="json",
        )
        self.assertEqual(putaway_response.status_code, status.HTTP_200_OK)

        task.refresh_from_db()
        receipt_balance.refresh_from_db()
        storage_balance = InventoryBalance.objects.get(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.storage_location,
            product=self.product,
            stock_status="AVAILABLE",
        )
        self.assertEqual(task.status, PutawayTaskStatus.COMPLETED)
        self.assertEqual(receipt_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(storage_balance.on_hand_qty, Decimal("5.0000"))

    def test_viewer_can_list_purchase_orders_but_cannot_create(self) -> None:
        self._create_purchase_order(po_number="PO-3001")

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get(
            reverse("organization-purchase-order-list", kwargs={"organization_id": self.organization.id})
        )
        create_response = self.client.post(
            reverse("organization-purchase-order-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "customer_account_id": self.customer_account.id,
                "po_number": "PO-3002",
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

