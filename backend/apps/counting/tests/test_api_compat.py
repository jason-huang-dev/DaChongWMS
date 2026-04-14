from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.services.session_service import issue_session_token
from apps.counting.models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLine, CycleCountLineStatus, CycleCountStatus
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
from apps.organizations.tests.test_factories import add_membership, make_organization, make_user
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class CountingCompatibilityAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.user = make_user("counting-compat@example.com", password="secret123", full_name="Counting Compat")
        self.organization = make_organization(name="Counting Compat Org", slug="counting-compat-org")
        self.membership = add_membership(self.user, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Counting Warehouse",
            code="COUNT-WH",
        )
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STO",
                name="Storage",
                usage=ZoneUsage.STORAGE,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="STD",
                name="Standard",
            )
        )
        self.location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=storage_zone,
                location_type=location_type,
                code="COUNT-01",
                barcode="COUNT-01",
            )
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-COUNT-100",
            name="Count Widget",
            barcode="BC-COUNT-100",
        )
        self.balance = InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.0000"),
            currency="USD",
        )
        pending_count = CycleCount.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            count_number="CC-100",
            status=CycleCountStatus.PENDING_APPROVAL,
        )
        rejected_count = CycleCount.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            count_number="CC-101",
            status=CycleCountStatus.REJECTED,
        )
        pending_line = CycleCountLine.objects.create(
            organization=self.organization,
            cycle_count=pending_count,
            line_number=1,
            inventory_balance=self.balance,
            location=self.location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            system_qty=Decimal("10.0000"),
            counted_qty=Decimal("8.0000"),
            variance_qty=Decimal("-2.0000"),
            status=CycleCountLineStatus.PENDING_APPROVAL,
        )
        rejected_line = CycleCountLine.objects.create(
            organization=self.organization,
            cycle_count=rejected_count,
            line_number=1,
            inventory_balance=self.balance,
            location=self.location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            system_qty=Decimal("10.0000"),
            counted_qty=Decimal("7.0000"),
            variance_qty=Decimal("-3.0000"),
            status=CycleCountLineStatus.REJECTED,
        )
        CountApproval.objects.create(
            organization=self.organization,
            cycle_count_line=pending_line,
            status=CountApprovalStatus.PENDING,
            requested_by=self.user.display_name,
            requested_at=timezone.now(),
            notes="Pending manager review",
        )
        CountApproval.objects.create(
            organization=self.organization,
            cycle_count_line=rejected_line,
            status=CountApprovalStatus.REJECTED,
            requested_by=self.user.display_name,
            requested_at=timezone.now(),
            rejected_by="Supervisor",
            rejected_at=timezone.now(),
            notes="Needs recount",
        )

        token = issue_session_token(membership=self.membership)
        self.client.credentials(
            HTTP_TOKEN=token,
            HTTP_OPENID=self.organization.slug,
            HTTP_OPERATOR=str(self.user.id),
        )

    def test_approval_summary_compat_endpoint_returns_dashboard_counts(self) -> None:
        response = self.client.get(
            reverse("compat-count-approval-summary"),
            {"warehouse": self.warehouse.id},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["pending_count"], 1)
        self.assertEqual(response.data["rejected_count"], 1)
        self.assertEqual(response.data["pending_by_warehouse"][0]["cycle_count_line__cycle_count__warehouse__name"], "Counting Warehouse")
        self.assertEqual(response.data["pending_by_warehouse"][0]["count"], 1)
