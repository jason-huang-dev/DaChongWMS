from __future__ import annotations

from datetime import date, datetime, timezone
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.common.operation_types import OperationOrderType
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
from apps.outbound.models import SalesOrder, SalesOrderFulfillmentStage, SalesOrderStatus, SalesOrderLine
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class OutboundCompatibilityAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("stock-out-compat@example.com", password="secret123", full_name="Stock-Out Compat")
        self.organization = make_organization(name="Stock-Out Compat Org", slug="stock-out-compat-org")
        self.membership = add_membership(self.user, self.organization)
        self.customer_account = make_customer_account(
            self.organization,
            name="Acme Retail",
            code="ACME",
            billing_email="acme@example.com",
        )
        self.customer_account.allow_dropshipping_orders = True
        self.customer_account.save()
        self.secondary_customer_account = make_customer_account(
            self.organization,
            name="Beta Stores",
            code="BETA",
            billing_email="beta@example.com",
        )
        self.secondary_customer_account.allow_dropshipping_orders = True
        self.secondary_customer_account.save()
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Outbound Warehouse",
            code="OUT-WH",
        )
        shipping_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="SHIP",
                name="Shipping",
                usage=ZoneUsage.SHIPPING,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="STAGE",
                name="Stage",
            )
        )
        self.staging_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=shipping_zone,
                location_type=location_type,
                code="STAGE-01",
                barcode="STAGE-01",
            )
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-OUT-100",
            name="Compat Scanner",
            barcode="BC-OUT-100",
        )

        self.order_one = self._create_sales_order(
            customer_account=self.customer_account,
            customer_code="ACME",
            customer_name="Acme Retail",
            fulfillment_stage=SalesOrderFulfillmentStage.GET_TRACKING_NO,
            logistics_provider="UPS",
            order_number="SO-100",
            order_time=datetime(2026, 3, 20, 10, 0, tzinfo=timezone.utc),
            package_count=1,
            reference_code="REF-100",
            requested_ship_date=date(2026, 3, 21),
            shipping_method="Ground",
            status=SalesOrderStatus.OPEN,
            tracking_number="",
            waybill_number="",
            waybill_printed=False,
        )
        self.order_two = self._create_sales_order(
            customer_account=self.customer_account,
            customer_code="ACME",
            customer_name="Acme Retail",
            exception_state="ABNORMAL_PACKAGE",
            fulfillment_stage=SalesOrderFulfillmentStage.TO_SHIP,
            logistics_provider="FedEx",
            order_number="SO-200",
            order_time=datetime(2026, 3, 21, 10, 0, tzinfo=timezone.utc),
            package_count=4,
            reference_code="ABN-200",
            requested_ship_date=date(2026, 3, 22),
            shipping_method="Express",
            status=SalesOrderStatus.ALLOCATED,
            tracking_number="TRK-200",
            waybill_number="WB-200",
            waybill_printed=True,
        )
        self.order_three = self._create_sales_order(
            customer_account=self.secondary_customer_account,
            customer_code="BETA",
            customer_name="Beta Stores",
            fulfillment_stage=SalesOrderFulfillmentStage.SHIPPED,
            logistics_provider="DHL",
            order_number="SO-300",
            order_time=datetime(2026, 3, 22, 10, 0, tzinfo=timezone.utc),
            package_count=6,
            reference_code="SHIP-300",
            requested_ship_date=date(2026, 3, 23),
            shipping_method="Air",
            status=SalesOrderStatus.SHIPPED,
            tracking_number="TRK-300",
            waybill_number="WB-300",
            waybill_printed=True,
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def _create_sales_order(
        self,
        *,
        customer_account,
        customer_code: str,
        customer_name: str,
        order_number: str,
        status: str,
        fulfillment_stage: str,
        requested_ship_date: date,
        order_time: datetime,
        package_count: int,
        logistics_provider: str,
        shipping_method: str,
        tracking_number: str,
        waybill_number: str,
        waybill_printed: bool,
        reference_code: str,
        exception_state: str = "NORMAL",
    ) -> SalesOrder:
        order = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=customer_account,
            staging_location=self.staging_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number=order_number,
            order_time=order_time,
            requested_ship_date=requested_ship_date,
            status=status,
            fulfillment_stage=fulfillment_stage,
            exception_state=exception_state,
            customer_code=customer_code,
            customer_name=customer_name,
            customer_contact_name="Outbound Lead",
            customer_contact_email="ops@example.com",
            customer_contact_phone="555-0100",
            package_count=package_count,
            package_type="Carton",
            logistics_provider=logistics_provider,
            shipping_method=shipping_method,
            tracking_number=tracking_number,
            waybill_number=waybill_number,
            waybill_printed=waybill_printed,
            reference_code=reference_code,
            receiver_name="Receiver",
            receiver_phone="555-1000",
            receiver_country="US",
            receiver_state="NY",
            receiver_city="New York",
            receiver_address="1 Demo Way",
            receiver_postal_code="10001",
        )
        SalesOrderLine.objects.create(
            organization=self.organization,
            sales_order=order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("1.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_price=Decimal("10.0000"),
        )
        return order

    def test_sales_order_compat_list_supports_stock_out_queue_filters(self) -> None:
        response = self.client.get(
            reverse("compat-sales-order-list"),
            {
                "exception_state": "ABNORMAL_PACKAGE",
                "fulfillment_stage": "TO_SHIP",
                "logistics_provider__icontains": "fed",
                "package_count__gte": 3,
                "package_count__lte": 4,
                "page_size": 100,
                "requested_ship_date__gte": "2026-03-22",
                "requested_ship_date__lte": "2026-03-22",
                "shipping_method__icontains": "press",
                "tracking_number__icontains": "200",
                "waybill_printed": "true",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["order_number"], "SO-200")
        self.assertEqual(response.data["results"][0]["waybill_number"], "WB-200")
        self.assertEqual(response.data["results"][0]["exception_state"], "ABNORMAL_PACKAGE")

    def test_sales_order_compat_list_supports_query_status_in_and_sorting(self) -> None:
        response = self.client.get(
            reverse("compat-sales-order-list"),
            {
                "page_size": 100,
                "query": "acme",
                "sortDirection": "desc",
                "sortKey": "requestedShipDate",
                "status__in": "OPEN,ALLOCATED",
            },
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(
            [record["order_number"] for record in response.data["results"]],
            ["SO-200", "SO-100"],
        )
