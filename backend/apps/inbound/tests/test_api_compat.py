from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.common.operation_types import OperationOrderType
from apps.inbound.models import PurchaseOrder, PurchaseOrderLine, PurchaseOrderLineStatus, PurchaseOrderStatus
from apps.inventory.models import InventoryStatus
from apps.organizations.tests.test_factories import add_membership, make_customer_account, make_organization, make_user
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InboundCompatibilityAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("inbound-compat@example.com", password="secret123", full_name="Inbound Compat")
        self.organization = make_organization(name="Inbound Compat Org", slug="inbound-compat-org")
        self.membership = add_membership(self.user, self.organization)
        self.customer_account = make_customer_account(
            self.organization,
            name="Inbound Client",
            code="INB-001",
            billing_email="inbound-client@example.com",
        )
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Inbound Compatibility Warehouse",
            code="INB-COMPAT-WH",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-INB-100",
            name="Inbound Widget",
            barcode="BC-INB-100",
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def _create_purchase_order(
        self,
        *,
        po_number: str,
        supplier_code: str,
        supplier_name: str,
        reference_code: str,
        status: str,
        create_time: datetime,
        expected_arrival_date: date | None = None,
    ) -> PurchaseOrder:
        purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            po_number=po_number,
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            supplier_code=supplier_code,
            supplier_name=supplier_name,
            supplier_contact_name="Dock Lead",
            supplier_contact_phone="555-0110",
            expected_arrival_date=expected_arrival_date,
            reference_code=reference_code,
            status=status,
            notes="Created for compat tests",
        )
        PurchaseOrder.objects.filter(pk=purchase_order.pk).update(create_time=create_time, update_time=create_time)
        purchase_order.refresh_from_db()

        PurchaseOrderLine.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("5.0000"),
            received_qty=Decimal("2.0000") if status == PurchaseOrderStatus.PARTIAL else Decimal("0.0000"),
            unit_cost=Decimal("3.5000"),
            stock_status=InventoryStatus.AVAILABLE,
            status=PurchaseOrderLineStatus.PARTIAL if status == PurchaseOrderStatus.PARTIAL else PurchaseOrderLineStatus.OPEN,
        )

        return purchase_order

    def test_purchase_order_compat_endpoint_returns_legacy_payload(self) -> None:
        purchase_order = self._create_purchase_order(
            po_number="PO-COMPAT-100",
            supplier_code="SUP-100",
            supplier_name="Atlas Freight",
            reference_code="REF-100",
            status=PurchaseOrderStatus.OPEN,
            create_time=timezone.make_aware(datetime(2026, 4, 3, 9, 15, 0)),
            expected_arrival_date=date(2026, 4, 9),
        )

        response = self.client.get(
            reverse("compat-purchase-order-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

        record = response.data["results"][0]
        self.assertEqual(record["id"], purchase_order.id)
        self.assertEqual(record["po_number"], "PO-COMPAT-100")
        self.assertEqual(record["customer_name"], "Inbound Client")
        self.assertEqual(record["customer_code"], "INB-001")
        self.assertEqual(record["supplier_name"], "Atlas Freight")
        self.assertEqual(record["reference_code"], "REF-100")
        self.assertEqual(record["lines"][0]["goods_code"], "SKU-INB-100")
        self.assertEqual(record["lines"][0]["ordered_qty"], "5.0000")

    def test_purchase_order_compat_filters_by_status_bucket_and_supplier_search(self) -> None:
        self._create_purchase_order(
            po_number="PO-COMPAT-OPEN",
            supplier_code="SUP-OPEN",
            supplier_name="North Logistics",
            reference_code="REF-OPEN",
            status=PurchaseOrderStatus.OPEN,
            create_time=timezone.make_aware(datetime(2026, 4, 1, 8, 0, 0)),
        )
        matching_order = self._create_purchase_order(
            po_number="PO-COMPAT-PARTIAL",
            supplier_code="SUP-PARTIAL",
            supplier_name="Blue Harbor Freight",
            reference_code="REF-PARTIAL",
            status=PurchaseOrderStatus.PARTIAL,
            create_time=timezone.make_aware(datetime(2026, 4, 2, 8, 0, 0)),
        )
        self._create_purchase_order(
            po_number="PO-COMPAT-CLOSED",
            supplier_code="SUP-CLOSED",
            supplier_name="Closed Carrier",
            reference_code="REF-CLOSED",
            status=PurchaseOrderStatus.CLOSED,
            create_time=timezone.make_aware(datetime(2026, 4, 3, 8, 0, 0)),
        )

        response = self.client.get(
            reverse("compat-purchase-order-list"),
            {
                "page_size": 100,
                "search_field": "supplier",
                "search_value": "Harbor",
                "status__in": "OPEN,PARTIAL",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], matching_order.id)

    def test_purchase_order_compat_filters_by_create_time_and_expected_arrival_date(self) -> None:
        april_order = self._create_purchase_order(
            po_number="PO-COMPAT-APRIL",
            supplier_code="SUP-APR",
            supplier_name="April Supplier",
            reference_code="REF-APR",
            status=PurchaseOrderStatus.OPEN,
            create_time=timezone.make_aware(datetime(2026, 4, 10, 10, 0, 0)),
            expected_arrival_date=date(2026, 5, 6),
        )
        may_order = self._create_purchase_order(
            po_number="PO-COMPAT-MAY",
            supplier_code="SUP-MAY",
            supplier_name="May Supplier",
            reference_code="REF-MAY",
            status=PurchaseOrderStatus.OPEN,
            create_time=timezone.make_aware(datetime(2026, 5, 10, 10, 0, 0)),
            expected_arrival_date=date(2026, 6, 11),
        )

        create_time_response = self.client.get(
            reverse("compat-purchase-order-list"),
            {
                "date_field": "create_time",
                "date_from": "2026-04-01",
                "date_to": "2026-04-30",
                "page_size": 100,
            },
        )
        expected_arrival_response = self.client.get(
            reverse("compat-purchase-order-list"),
            {
                "date_field": "expected_arrival_date",
                "date_from": "2026-06-01",
                "date_to": "2026-06-30",
                "page_size": 100,
            },
        )

        self.assertEqual(create_time_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_time_response.data["count"], 1)
        self.assertEqual(create_time_response.data["results"][0]["id"], april_order.id)

        self.assertEqual(expected_arrival_response.status_code, status.HTTP_200_OK)
        self.assertEqual(expected_arrival_response.data["count"], 1)
        self.assertEqual(expected_arrival_response.data["results"][0]["id"], may_order.id)

    def test_purchase_order_compat_maps_legacy_received_status_to_closed(self) -> None:
        closed_order = self._create_purchase_order(
            po_number="PO-COMPAT-CLOSED-LEGACY",
            supplier_code="SUP-LEGACY",
            supplier_name="Legacy Carrier",
            reference_code="REF-LEGACY",
            status=PurchaseOrderStatus.CLOSED,
            create_time=timezone.make_aware(datetime(2026, 4, 11, 10, 0, 0)),
        )
        self._create_purchase_order(
            po_number="PO-COMPAT-OPEN-LEGACY",
            supplier_code="SUP-OPEN-LEGACY",
            supplier_name="Open Carrier",
            reference_code="REF-OPEN-LEGACY",
            status=PurchaseOrderStatus.OPEN,
            create_time=timezone.make_aware(datetime(2026, 4, 12, 10, 0, 0)),
        )

        response = self.client.get(
            reverse("compat-purchase-order-list"),
            {"page_size": 100, "status": "RECEIVED"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["id"], closed_order.id)
