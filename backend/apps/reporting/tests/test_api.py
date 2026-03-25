from __future__ import annotations

from datetime import timedelta
from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from apps.common.operation_types import OperationOrderType
from apps.counting.models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLine
from apps.iam.models import Role
from apps.inbound.models import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus, Receipt, ReceiptLine
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
from apps.outbound.models import PickTask, PickTaskStatus, SalesOrder, SalesOrderLine, SalesOrderStatus
from apps.products.models import Product
from apps.returns.models import ReturnOrder, ReturnOrderStatus
from apps.warehouse.models import Warehouse


class ReportingAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("report-manager@example.com")
        self.viewer = make_user("report-viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Reporting Warehouse",
            code="RPT-WH",
        )
        self.customer_account = make_customer_account(
            self.organization,
            name="Reporting Client",
            code="RPT-CLIENT",
            billing_email="billing@reporting.test",
        )
        self.customer_account.contact_name = "Reporting Ops"
        self.customer_account.contact_email = "ops@reporting.test"
        self.customer_account.contact_phone = "555-0190"
        self.customer_account.save()
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-RPT-001",
            barcode="BC-RPT-001",
            name="Reporting Widget",
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
        shipping_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="SHP",
                name="Shipping",
                usage=ZoneUsage.SHIPPING,
                sequence=20,
            )
        )
        returns_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="RET",
                name="Returns",
                usage=ZoneUsage.RETURNS,
                sequence=30,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="STD",
                name="Standard",
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
        self.balance = InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.storage_location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("2.0000"),
            hold_qty=Decimal("1.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
            last_movement_at=timezone.now() - timedelta(days=5),
        )

        purchase_order = PurchaseOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            po_number="PO-RPT-1",
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
            ordered_qty=Decimal("5.0000"),
            received_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            stock_status=InventoryStatus.AVAILABLE,
        )
        receipt = Receipt.objects.create(
            organization=self.organization,
            purchase_order=purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number="RCPT-RPT-1",
            received_by="receiver@example.com",
        )
        receipt_line = ReceiptLine.objects.create(
            organization=self.organization,
            receipt=receipt,
            purchase_order_line=purchase_order_line,
            product=self.product,
            receipt_location=self.receiving_location,
            received_qty=Decimal("3.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("5.5000"),
        )
        PutawayTask.objects.create(
            organization=self.organization,
            receipt_line=receipt_line,
            warehouse=self.warehouse,
            product=self.product,
            task_number="PT-RPT-1",
            from_location=self.receiving_location,
            quantity=Decimal("3.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            status=PutawayTaskStatus.OPEN,
        )

        sales_order = SalesOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            staging_location=self.shipping_location,
            order_type=OperationOrderType.STANDARD,
            order_number="SO-RPT-1",
            status=SalesOrderStatus.OPEN,
        )
        sales_order_line = SalesOrderLine.objects.create(
            organization=self.organization,
            sales_order=sales_order,
            line_number=1,
            product=self.product,
            ordered_qty=Decimal("2.0000"),
            stock_status=InventoryStatus.AVAILABLE,
        )
        PickTask.objects.create(
            organization=self.organization,
            sales_order_line=sales_order_line,
            warehouse=self.warehouse,
            from_location=self.storage_location,
            to_location=self.shipping_location,
            task_number="PK-RPT-1",
            quantity=Decimal("2.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            status=PickTaskStatus.OPEN,
        )

        cycle_count = CycleCount.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            count_number="CC-RPT-1",
        )
        cycle_count_line = CycleCountLine.objects.create(
            organization=self.organization,
            cycle_count=cycle_count,
            line_number=1,
            inventory_balance=self.balance,
            location=self.storage_location,
            product=self.product,
            stock_status=InventoryStatus.AVAILABLE,
            system_qty=Decimal("10.0000"),
        )
        CountApproval.objects.create(
            organization=self.organization,
            cycle_count_line=cycle_count_line,
            status=CountApprovalStatus.PENDING,
            requested_by="counter@example.com",
            requested_at=timezone.now(),
        )

        ReturnOrder.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            customer_account=self.customer_account,
            return_number="RMA-RPT-1",
            customer_code=self.customer_account.code,
            customer_name=self.customer_account.name,
            customer_contact_name=self.customer_account.contact_name,
            customer_contact_email=self.customer_account.contact_email,
            customer_contact_phone=self.customer_account.contact_phone,
            status=ReturnOrderStatus.OPEN,
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)
        for codename in ("view_reporting", "manage_reporting"):
            permission = Permission.objects.get(content_type__app_label="reporting", codename=codename)
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(content_type__app_label="reporting", codename="view_reporting")
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_generate_kpi_snapshot(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse(
                "organization-reporting-kpi-snapshot-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "snapshot_date": timezone.now().date().isoformat(),
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["on_hand_qty"], "10.0000")
        self.assertEqual(response.data["available_qty"], "7.0000")
        self.assertEqual(response.data["allocated_qty"], "2.0000")
        self.assertEqual(response.data["hold_qty"], "1.0000")
        self.assertEqual(response.data["open_purchase_orders"], 1)
        self.assertEqual(response.data["open_sales_orders"], 1)
        self.assertEqual(response.data["open_putaway_tasks"], 1)
        self.assertEqual(response.data["open_pick_tasks"], 1)
        self.assertEqual(response.data["pending_count_approvals"], 1)
        self.assertEqual(response.data["pending_return_orders"], 1)

    def test_manager_can_generate_inventory_aging_report_and_download(self) -> None:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse(
                "organization-report-export-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "report_type": "INVENTORY_AGING",
                "date_to": timezone.now().date().isoformat(),
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["row_count"], 1)
        self.assertIn("SKU-RPT-001", response.data["content"])

        download_response = self.client.get(
            reverse(
                "organization-report-export-download",
                kwargs={
                    "organization_id": self.organization.id,
                    "report_export_id": response.data["id"],
                },
            )
        )
        self.assertEqual(download_response.status_code, status.HTTP_200_OK)
        self.assertIn("text/csv", download_response["Content-Type"])
        self.assertIn("SKU-RPT-001", download_response.content.decode("utf-8"))

    def test_viewer_can_list_reports_but_cannot_create(self) -> None:
        self.client.force_authenticate(self.manager)
        snapshot_response = self.client.post(
            reverse(
                "organization-reporting-kpi-snapshot-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "snapshot_date": timezone.now().date().isoformat(),
            },
            format="json",
        )
        self.assertEqual(snapshot_response.status_code, status.HTTP_201_CREATED)

        self.client.force_authenticate(self.viewer)
        list_response = self.client.get(
            reverse(
                "organization-reporting-kpi-snapshot-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        create_response = self.client.post(
            reverse(
                "organization-report-export-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "report_type": "INVENTORY_AGING",
            },
            format="json",
        )
        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
