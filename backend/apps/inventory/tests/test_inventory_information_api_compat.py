from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.common.operation_types import OperationOrderType
from apps.inbound.models import PurchaseOrder, PurchaseOrderLine, PutawayTask, Receipt, ReceiptLine
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
from apps.organizations.tests.test_factories import add_membership, make_customer_account, make_organization, make_user
from apps.outbound.models import SalesOrder, SalesOrderLine
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InventoryInformationCompatibilityAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("inventory-user@example.com", password="secret123", full_name="Inventory User")
        self.organization = make_organization(name="Inventory Org", slug="inventory-org")
        self.membership = add_membership(self.user, self.organization)
        self.customer_account = make_customer_account(
            self.organization,
            name="Inventory Client",
            code="INV-CLIENT",
            billing_email="inventory-client@example.com",
        )
        self.customer_account.allow_inbound_goods = True
        self.customer_account.allow_dropshipping_orders = True
        self.customer_account.save()
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary Warehouse",
            code="WH-1",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-100",
            name="Seeded Widget",
            barcode="BC-100",
            category="Widgets",
            brand="Acme",
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
        staging_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STG",
                name="Staging",
                usage=ZoneUsage.SHIPPING,
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
        self.receiving_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=receiving_zone,
                location_type=location_type,
                code="RCV-01",
                barcode="RCV-01",
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
                pick_sequence=10,
            )
        )
        self.staging_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=staging_zone,
                location_type=location_type,
                code="STG-01",
                barcode="STG-01",
                pick_sequence=20,
            )
        )

        InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.storage_location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("3.0000"),
            hold_qty=Decimal("1.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
        )

        self.purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            po_number="PO-100",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            supplier_code="SUP-100",
            supplier_name="Supplier 100",
            supplier_contact_name="Dock Lead",
            supplier_contact_phone="555-0100",
            status="OPEN",
        )
        purchase_order_line = PurchaseOrderLine.objects.create(
            organization=self.organization,
            purchase_order=self.purchase_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("8.0000"),
            received_qty=Decimal("2.0000"),
            unit_cost=Decimal("4.5000"),
            stock_status=InventoryStatus.AVAILABLE,
            status="OPEN",
        )
        receipt = Receipt.objects.create(
            organization=self.organization,
            purchase_order=self.purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number="RCT-100",
            received_by=self.user.display_name,
        )
        receipt_line = ReceiptLine.objects.create(
            organization=self.organization,
            receipt=receipt,
            purchase_order_line=purchase_order_line,
            product=self.product,
            receipt_location=self.receiving_location,
            received_qty=Decimal("4.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("4.5000"),
        )
        PutawayTask.objects.create(
            organization=self.organization,
            receipt_line=receipt_line,
            warehouse=self.warehouse,
            product=self.product,
            task_number="PT-100",
            from_location=self.receiving_location,
            to_location=self.storage_location,
            quantity=Decimal("4.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            status="OPEN",
            assigned_membership=self.membership,
        )

        sales_order = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            staging_location=self.staging_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number="SO-100",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            status="OPEN",
            fulfillment_stage="GET_TRACKING_NO",
            exception_state="NORMAL",
        )
        SalesOrderLine.objects.create(
            organization=self.organization,
            sales_order=sales_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("6.0000"),
            allocated_qty=Decimal("3.0000"),
            picked_qty=Decimal("0.0000"),
            shipped_qty=Decimal("0.0000"),
            unit_price=Decimal("9.9900"),
            stock_status=InventoryStatus.AVAILABLE,
            status="ALLOCATED",
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def test_inventory_information_compat_endpoints_return_legacy_denormalized_payloads(self) -> None:
        balances_response = self.client.get(
            reverse("compat-inventory-balance-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )
        locations_response = self.client.get(
            reverse("compat-location-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )
        purchase_orders_response = self.client.get(
            reverse("compat-purchase-order-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )
        putaway_tasks_response = self.client.get(
            reverse("compat-putaway-task-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )
        sales_orders_response = self.client.get(
            reverse("compat-sales-order-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )

        self.assertEqual(balances_response.status_code, status.HTTP_200_OK)
        self.assertEqual(locations_response.status_code, status.HTTP_200_OK)
        self.assertEqual(purchase_orders_response.status_code, status.HTTP_200_OK)
        self.assertEqual(putaway_tasks_response.status_code, status.HTTP_200_OK)
        self.assertEqual(sales_orders_response.status_code, status.HTTP_200_OK)

        balance = balances_response.data["results"][0]
        self.assertEqual(balance["goods_code"], "SKU-100")
        self.assertEqual(balance["warehouse_name"], "Primary Warehouse")
        self.assertEqual(balance["location_code"], "STO-01")
        self.assertEqual(balance["available_qty"], "6.0000")

        location_codes = {location["location_code"] for location in locations_response.data["results"]}
        self.assertEqual(location_codes, {"RCV-01", "STO-01", "STG-01"})
        storage_location = next(
            location for location in locations_response.data["results"] if location["location_code"] == "STO-01"
        )
        self.assertEqual(storage_location["zone_code"], "STO")
        self.assertEqual(storage_location["location_type_code"], "STD")

        purchase_order = purchase_orders_response.data["results"][0]
        self.assertEqual(purchase_order["po_number"], "PO-100")
        self.assertEqual(purchase_order["supplier_name"], "Supplier 100")
        self.assertEqual(purchase_order["customer_code"], "INV-CLIENT")
        self.assertEqual(purchase_order["lines"][0]["goods_code"], "SKU-100")

        putaway_task = putaway_tasks_response.data["results"][0]
        self.assertEqual(putaway_task["task_number"], "PT-100")
        self.assertEqual(putaway_task["receipt_number"], "RCT-100")
        self.assertEqual(putaway_task["from_location_code"], "RCV-01")
        self.assertEqual(putaway_task["to_location_code"], "STO-01")
        self.assertEqual(putaway_task["goods_code"], "SKU-100")

        sales_order = sales_orders_response.data["results"][0]
        self.assertEqual(sales_order["order_number"], "SO-100")
        self.assertEqual(sales_order["customer_name"], "Inventory Client")
        self.assertEqual(sales_order["staging_location_code"], "STG-01")
        self.assertEqual(sales_order["lines"][0]["goods_code"], "SKU-100")
        self.assertEqual(sales_order["lines"][0]["allocated_qty"], "3.0000")
