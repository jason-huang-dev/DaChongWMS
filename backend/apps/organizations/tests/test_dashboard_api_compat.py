from __future__ import annotations

from datetime import datetime, timedelta
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.common.operation_types import OperationOrderType
from apps.inbound.models import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, Receipt, ReceiptLine
from apps.inventory.models import InventoryStatus
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
from apps.outbound.models import SalesOrder, SalesOrderStatus
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class CompatibilityDashboardOrderStatisticsTests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("dashboard-user@example.com", password="secret123", full_name="Dashboard User")
        self.organization = make_organization(name="Dashboard Org", slug="dashboard-org")
        self.membership = add_membership(self.user, self.organization)
        self.customer_account = make_customer_account(
            self.organization,
            name="Dashboard Client",
            code="DB-CLIENT",
            billing_email="billing@dashboard.test",
        )
        self.customer_account.allow_dropshipping_orders = True
        self.customer_account.contact_name = "Dashboard Ops"
        self.customer_account.contact_email = "ops@dashboard.test"
        self.customer_account.contact_phone = "555-0101"
        self.customer_account.save()
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Main Warehouse",
            code="MAIN-WH",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-DB-001",
            barcode="BC-DB-001",
            name="Dashboard Widget",
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
        shipping_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="SHP",
                name="Shipping",
                usage=ZoneUsage.SHIPPING,
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
        self.receiving_location = create_location(
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
        self.shipping_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=shipping_zone,
                location_type=location_type,
                code="SHP-01",
                barcode="SHP-01",
                is_pick_face=False,
            )
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def test_returns_daily_dropshipping_orders_and_stock_in_quantities(self) -> None:
        today = timezone.localdate()
        week_start = today - timedelta(days=today.weekday())
        second_day = min(week_start + timedelta(days=1), today)
        previous_week_day = week_start - timedelta(days=1)

        purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            po_number="PO-DB-1",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            supplier_code="SUP-1",
            supplier_name="Supplier Co",
            supplier_contact_name="Dock Lead",
            supplier_contact_phone="555-0101",
            status=PurchaseOrderStatus.OPEN,
        )
        purchase_order_line = PurchaseOrderLine.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("20.0000"),
            received_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            stock_status=InventoryStatus.AVAILABLE,
        )

        self._create_receipt(purchase_order_line=purchase_order_line, target_date=week_start, quantity=Decimal("3.0000"), suffix="1")
        self._create_receipt(purchase_order_line=purchase_order_line, target_date=second_day, quantity=Decimal("2.0000"), suffix="2")
        self._create_receipt(purchase_order_line=purchase_order_line, target_date=previous_week_day, quantity=Decimal("7.0000"), suffix="3")

        self._create_sales_order(target_date=week_start, suffix="1")
        self._create_sales_order(target_date=second_day, suffix="2")
        self._create_sales_order(target_date=previous_week_day, suffix="3")

        response = self.client.get(
            reverse("compat-dashboard-order-statistics"),
            {
                "time_window": "WEEK",
                "warehouse": self.warehouse.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["time_window"], "WEEK")
        self.assertEqual(response.data["date_from"], f"{week_start.isoformat()}T00:00")
        self.assertEqual(response.data["date_to"], f"{today.isoformat()}T{timezone.localtime().hour:02d}:00")
        self.assertEqual(response.data["summary"]["dropshipping_orders"], 2)
        self.assertAlmostEqual(response.data["summary"]["stock_in_quantity"], 5.0)

        buckets = {row["date"]: row for row in response.data["buckets"]}
        self.assertEqual(buckets[week_start.isoformat()]["dropshipping_orders"], 1)
        self.assertAlmostEqual(buckets[week_start.isoformat()]["stock_in_quantity"], 3.0)
        self.assertEqual(buckets[second_day.isoformat()]["dropshipping_orders"], 1)
        self.assertAlmostEqual(buckets[second_day.isoformat()]["stock_in_quantity"], 2.0)
        self.assertNotIn(previous_week_day.isoformat(), buckets)

    def test_returns_custom_date_range_when_requested(self) -> None:
        today = timezone.localdate()
        date_from = today - timedelta(days=2)
        date_to = today - timedelta(days=1)

        purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            po_number="PO-DB-CUSTOM",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            supplier_code="SUP-1",
            supplier_name="Supplier Co",
            supplier_contact_name="Dock Lead",
            supplier_contact_phone="555-0101",
            status=PurchaseOrderStatus.OPEN,
        )
        purchase_order_line = PurchaseOrderLine.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("20.0000"),
            received_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            stock_status=InventoryStatus.AVAILABLE,
        )

        self._create_receipt(
            purchase_order_line=purchase_order_line,
            target_date=date_from,
            quantity=Decimal("4.0000"),
            suffix="custom-1",
        )
        self._create_receipt(
            purchase_order_line=purchase_order_line,
            target_date=today,
            quantity=Decimal("9.0000"),
            suffix="custom-2",
        )
        self._create_sales_order(target_date=date_to, suffix="custom-1")
        self._create_sales_order(target_date=today, suffix="custom-2")

        response = self.client.get(
            reverse("compat-dashboard-order-statistics"),
            {
                "time_window": "CUSTOM",
                "date_from": date_from.isoformat(),
                "date_to": date_to.isoformat(),
                "warehouse": self.warehouse.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["time_window"], "CUSTOM")
        self.assertEqual(response.data["date_from"], date_from.isoformat())
        self.assertEqual(response.data["date_to"], date_to.isoformat())
        self.assertEqual(response.data["summary"]["dropshipping_orders"], 1)
        self.assertAlmostEqual(response.data["summary"]["stock_in_quantity"], 4.0)

        buckets = {row["date"]: row for row in response.data["buckets"]}
        self.assertEqual(set(buckets.keys()), {date_from.isoformat(), date_to.isoformat()})
        self.assertAlmostEqual(buckets[date_from.isoformat()]["stock_in_quantity"], 4.0)
        self.assertEqual(buckets[date_to.isoformat()]["dropshipping_orders"], 1)

    def test_returns_hourly_buckets_for_short_custom_datetime_ranges(self) -> None:
        target_date = timezone.localdate() - timedelta(days=1)
        date_from = f"{target_date.isoformat()}T08:00"
        date_to = f"{target_date.isoformat()}T12:00"

        purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            po_number="PO-DB-HOURLY",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            supplier_code="SUP-1",
            supplier_name="Supplier Co",
            supplier_contact_name="Dock Lead",
            supplier_contact_phone="555-0101",
            status=PurchaseOrderStatus.OPEN,
        )
        purchase_order_line = PurchaseOrderLine.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("20.0000"),
            received_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            stock_status=InventoryStatus.AVAILABLE,
        )

        receipt_one = Receipt.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number="RCPT-DB-hour-1",
            received_by="receiver@example.com",
            received_at=timezone.make_aware(datetime.combine(target_date, datetime.min.time()).replace(hour=9)),
        )
        ReceiptLine.objects.create(
            organization=self.organization,
            receipt=receipt_one,
            purchase_order_line=purchase_order_line,
            product=self.product,
            receipt_location=self.receiving_location,
            received_qty=Decimal("4.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("4.5000"),
        )

        receipt_two = Receipt.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number="RCPT-DB-hour-2",
            received_by="receiver@example.com",
            received_at=timezone.make_aware(datetime.combine(target_date, datetime.min.time()).replace(hour=11)),
        )
        ReceiptLine.objects.create(
            organization=self.organization,
            receipt=receipt_two,
            purchase_order_line=purchase_order_line,
            product=self.product,
            receipt_location=self.receiving_location,
            received_qty=Decimal("1.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("4.5000"),
        )

        sales_order_one = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            staging_location=self.shipping_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number="SO-DB-hour-1",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            customer_contact_name=self.customer_account.contact_name,
            customer_contact_email=self.customer_account.contact_email,
            customer_contact_phone=self.customer_account.contact_phone,
            status=SalesOrderStatus.OPEN,
        )
        SalesOrder.objects.filter(pk=sales_order_one.pk).update(
            create_time=timezone.make_aware(datetime.combine(target_date, datetime.min.time()).replace(hour=9))
        )

        sales_order_two = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            staging_location=self.shipping_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number="SO-DB-hour-2",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            customer_contact_name=self.customer_account.contact_name,
            customer_contact_email=self.customer_account.contact_email,
            customer_contact_phone=self.customer_account.contact_phone,
            status=SalesOrderStatus.OPEN,
        )
        SalesOrder.objects.filter(pk=sales_order_two.pk).update(
            create_time=timezone.make_aware(datetime.combine(target_date, datetime.min.time()).replace(hour=11))
        )

        response = self.client.get(
            reverse("compat-dashboard-order-statistics"),
            {
                "time_window": "CUSTOM",
                "date_from": date_from,
                "date_to": date_to,
                "warehouse": self.warehouse.id,
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["time_window"], "CUSTOM")
        self.assertEqual(response.data["date_from"], date_from)
        self.assertEqual(response.data["date_to"], date_to)
        self.assertEqual(response.data["summary"]["dropshipping_orders"], 2)
        self.assertAlmostEqual(response.data["summary"]["stock_in_quantity"], 5.0)

        buckets = {row["date"]: row for row in response.data["buckets"]}
        self.assertEqual(
            set(buckets.keys()),
            {
                f"{target_date.isoformat()}T08:00",
                f"{target_date.isoformat()}T09:00",
                f"{target_date.isoformat()}T10:00",
                f"{target_date.isoformat()}T11:00",
                f"{target_date.isoformat()}T12:00",
            },
        )
        self.assertEqual(buckets[f"{target_date.isoformat()}T09:00"]["dropshipping_orders"], 1)
        self.assertAlmostEqual(buckets[f"{target_date.isoformat()}T09:00"]["stock_in_quantity"], 4.0)
        self.assertEqual(buckets[f"{target_date.isoformat()}T11:00"]["dropshipping_orders"], 1)
        self.assertAlmostEqual(buckets[f"{target_date.isoformat()}T11:00"]["stock_in_quantity"], 1.0)

    def _create_sales_order(self, *, target_date, suffix: str) -> None:
        sales_order = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            staging_location=self.shipping_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number=f"SO-DB-{suffix}",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            customer_contact_name=self.customer_account.contact_name,
            customer_contact_email=self.customer_account.contact_email,
            customer_contact_phone=self.customer_account.contact_phone,
            status=SalesOrderStatus.OPEN,
        )
        SalesOrder.objects.filter(pk=sales_order.id).update(
            create_time=timezone.make_aware(datetime.combine(target_date, datetime.min.time())),
        )

    def _create_receipt(
        self,
        *,
        purchase_order_line: PurchaseOrderLine,
        target_date,
        quantity: Decimal,
        suffix: str,
    ) -> None:
        receipt = Receipt.objects.create(
            organization=self.organization,
            purchase_order=purchase_order_line.purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number=f"RCPT-DB-{suffix}",
            received_by="receiver@example.com",
            received_at=timezone.make_aware(datetime.combine(target_date, datetime.min.time())),
        )
        ReceiptLine.objects.create(
            organization=self.organization,
            receipt=receipt,
            purchase_order_line=purchase_order_line,
            product=self.product,
            receipt_location=self.receiving_location,
            received_qty=quantity,
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("4.5000"),
        )
