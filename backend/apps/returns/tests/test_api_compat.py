from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.common.operation_types import OperationOrderType
from apps.organizations.tests.test_factories import add_membership, make_customer_account, make_organization, make_user
from apps.products.models import Product
from apps.returns.models import ReturnLine, ReturnOrder
from apps.warehouse.models import Warehouse


class ReturnsCompatibilityAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("returns-compat@example.com", password="secret123", full_name="Returns Compat")
        self.organization = make_organization(name="Returns Compat Org", slug="returns-compat-org")
        self.membership = add_membership(self.user, self.organization)
        self.customer_account = make_customer_account(
            self.organization,
            name="Returns Client",
            code="RET-001",
            billing_email="returns-client@example.com",
        )
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Returns Warehouse",
            code="RET-WH",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-RET-100",
            name="Returned Widget",
            barcode="BC-RET-100",
        )
        self.return_order = ReturnOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            order_type=OperationOrderType.STANDARD,
            return_number="RMA-100",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            customer_contact_name="Returns Lead",
            customer_contact_email="lead@example.com",
            customer_contact_phone="555-0110",
            requested_date=None,
            reference_code="RET-REF-100",
            status="OPEN",
            notes="Created from customer portal",
        )
        ReturnLine.objects.create(
            organization=self.organization,
            return_order=self.return_order,
            line_number=1,
            product=self.product,
            expected_qty=Decimal("2.0000"),
            received_qty=Decimal("1.0000"),
            disposed_qty=Decimal("0.0000"),
            return_reason="Damaged carton",
            status="PARTIAL_RECEIVED",
            notes="Awaiting second carton",
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def test_return_order_compat_endpoints_return_legacy_payload(self) -> None:
        list_response = self.client.get(
            reverse("compat-return-order-list"),
            {"warehouse": self.warehouse.id, "page_size": 100},
        )
        detail_response = self.client.get(
            reverse("compat-return-order-detail", kwargs={"return_order_id": self.return_order.id})
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(detail_response.status_code, status.HTTP_200_OK)

        record = list_response.data["results"][0]
        self.assertEqual(record["return_number"], "RMA-100")
        self.assertEqual(record["customer_name"], "Returns Client")
        self.assertEqual(record["reference_code"], "RET-REF-100")
        self.assertEqual(record["lines"][0]["goods_code"], "SKU-RET-100")
        self.assertEqual(record["lines"][0]["received_qty"], "1.0000")

        self.assertEqual(detail_response.data["id"], self.return_order.id)
        self.assertEqual(detail_response.data["return_number"], "RMA-100")
        self.assertEqual(detail_response.data["lines"][0]["return_reason"], "Damaged carton")
