from __future__ import annotations

from decimal import Decimal

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.counting.models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLineStatus, CycleCountStatus
from apps.iam.models import Role
from apps.inventory.models import AdjustmentDirection, InventoryAdjustmentReason, InventoryBalance, InventoryMovement, MovementType
from apps.inventory.services.inventory_service import (
    CreateInventoryAdjustmentReasonInput,
    create_inventory_adjustment_reason,
)
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
    make_organization,
    make_role,
    make_user,
)
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class CountingAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.counter = make_user("counter@example.com")
        self.viewer = make_user("viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.counter_membership = add_membership(self.counter, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
                usage=ZoneUsage.STORAGE,
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="BULK",
                name="Bulk",
            )
        )
        self.location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=storage_zone,
                location_type=location_type,
                code="BULK-01",
                barcode="BULK-01",
            )
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-COUNT-001",
            barcode="BC-COUNT-001",
            name="Count Widget",
        )
        self.balance = InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.location,
            product=self.product,
            stock_status="AVAILABLE",
            lot_number="LOT-1",
            serial_number="",
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.0000"),
            currency="USD",
        )
        self.reason_auto = create_inventory_adjustment_reason(
            CreateInventoryAdjustmentReasonInput(
                organization=self.organization,
                code="COUNT_AUTO",
                name="Count Auto",
                direction=AdjustmentDirection.BOTH,
                requires_approval=False,
            )
        )
        self.reason_approval = create_inventory_adjustment_reason(
            CreateInventoryAdjustmentReasonInput(
                organization=self.organization,
                code="COUNT_APPR",
                name="Count Approval",
                direction=AdjustmentDirection.BOTH,
                requires_approval=True,
            )
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_counting", "manage_counting", "manage_count_approvals"):
            permission = Permission.objects.get(
                content_type__app_label="counting",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        for codename in ("view_counting", "manage_counting"):
            permission = Permission.objects.get(
                content_type__app_label="counting",
                codename=codename,
            )
            grant_role_permission(staff_role, permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.counter_membership, staff_role)
        assign_role(self.viewer_membership, staff_role)

    def _create_cycle_count(self, *, count_number: str, blind: bool = False) -> int:
        self.client.force_authenticate(self.manager)
        response = self.client.post(
            reverse("organization-cycle-count-list", kwargs={"organization_id": self.organization.id}),
            {
                "warehouse_id": self.warehouse.id,
                "count_number": count_number,
                "is_blind_count": blind,
                "line_items": [
                    {
                        "inventory_balance_id": self.balance.id,
                        "assigned_membership_id": self.counter_membership.id,
                    }
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        return int(response.data["id"])

    def test_blind_count_hides_system_qty_and_allows_scan_count(self) -> None:
        cycle_count_id = self._create_cycle_count(count_number="CC-BLIND-1", blind=True)

        self.client.force_authenticate(self.counter)
        task_response = self.client.get(
            reverse(
                "organization-cycle-count-line-next-task",
                kwargs={"organization_id": self.organization.id},
            )
        )
        self.assertEqual(task_response.status_code, status.HTTP_200_OK)
        self.assertEqual(task_response.data["cycle_count_id"], cycle_count_id)
        self.assertEqual(task_response.data["task_type"], "COUNT")
        self.assertIsNone(task_response.data["system_qty"])

        count_response = self.client.post(
            reverse(
                "organization-cycle-count-line-scan-count",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "location": self.location.barcode,
                "sku": self.product.barcode,
                "count_number": "CC-BLIND-1",
                "counted_qty": "9.0000",
                "adjustment_reason_id": self.reason_auto.id,
            },
            format="json",
        )
        self.assertEqual(count_response.status_code, status.HTTP_200_OK)

        line = CycleCount.objects.get(pk=cycle_count_id).lines.get()
        self.assertEqual(line.counted_qty, Decimal("9.0000"))
        self.assertEqual(line.counted_by, self.counter.email)

    def test_submit_variance_creates_pending_approval_and_manager_can_approve(self) -> None:
        cycle_count_id = self._create_cycle_count(count_number="CC-APPROVAL-1")
        cycle_count = CycleCount.objects.get(pk=cycle_count_id)
        line = cycle_count.lines.get()

        self.client.force_authenticate(self.counter)
        count_response = self.client.patch(
            reverse(
                "organization-cycle-count-line-detail",
                kwargs={
                    "organization_id": self.organization.id,
                    "cycle_count_line_id": line.id,
                },
            ),
            {
                "counted_qty": "8.0000",
                "adjustment_reason_id": self.reason_approval.id,
            },
            format="json",
        )
        self.assertEqual(count_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.manager)
        submit_response = self.client.post(
            reverse(
                "organization-cycle-count-submit",
                kwargs={"organization_id": self.organization.id, "cycle_count_id": cycle_count.id},
            ),
            {},
            format="json",
        )
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK)

        cycle_count.refresh_from_db()
        approval = CountApproval.objects.get(cycle_count_line=line)
        self.assertEqual(cycle_count.status, CycleCountStatus.PENDING_APPROVAL)
        self.assertEqual(approval.status, CountApprovalStatus.PENDING)

        approve_response = self.client.post(
            reverse(
                "organization-count-approval-approve",
                kwargs={"organization_id": self.organization.id, "approval_id": approval.id},
            ),
            {"notes": "Approved"},
            format="json",
        )
        self.assertEqual(approve_response.status_code, status.HTTP_200_OK)

        cycle_count.refresh_from_db()
        line.refresh_from_db()
        approval.refresh_from_db()
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.COMPLETED)
        self.assertEqual(line.status, CycleCountLineStatus.RECONCILED)
        self.assertEqual(approval.status, CountApprovalStatus.APPROVED)
        self.assertEqual(self.balance.on_hand_qty, Decimal("8.0000"))
        self.assertEqual(
            InventoryMovement.objects.filter(movement_type=MovementType.ADJUSTMENT_OUT).count(),
            1,
        )

    def test_reject_then_recount_can_be_resubmitted(self) -> None:
        cycle_count_id = self._create_cycle_count(count_number="CC-RECOUNT-1")
        cycle_count = CycleCount.objects.get(pk=cycle_count_id)
        line = cycle_count.lines.get()

        self.client.force_authenticate(self.counter)
        first_count = self.client.patch(
            reverse(
                "organization-cycle-count-line-detail",
                kwargs={
                    "organization_id": self.organization.id,
                    "cycle_count_line_id": line.id,
                },
            ),
            {
                "counted_qty": "7.0000",
                "adjustment_reason_id": self.reason_approval.id,
            },
            format="json",
        )
        self.assertEqual(first_count.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.manager)
        submit_response = self.client.post(
            reverse(
                "organization-cycle-count-submit",
                kwargs={"organization_id": self.organization.id, "cycle_count_id": cycle_count.id},
            ),
            {},
            format="json",
        )
        self.assertEqual(submit_response.status_code, status.HTTP_200_OK)

        approval = CountApproval.objects.get(cycle_count_line=line)
        reject_response = self.client.post(
            reverse(
                "organization-count-approval-reject",
                kwargs={"organization_id": self.organization.id, "approval_id": approval.id},
            ),
            {"notes": "Recount required"},
            format="json",
        )
        self.assertEqual(reject_response.status_code, status.HTTP_200_OK)

        assign_response = self.client.post(
            reverse(
                "organization-cycle-count-line-assign-recount",
                kwargs={"organization_id": self.organization.id, "cycle_count_line_id": line.id},
            ),
            {"assigned_membership_id": self.counter_membership.id},
            format="json",
        )
        self.assertEqual(assign_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.counter)
        recount_response = self.client.post(
            reverse(
                "organization-cycle-count-line-recount",
                kwargs={"organization_id": self.organization.id, "cycle_count_line_id": line.id},
            ),
            {
                "counted_qty": "10.0000",
                "adjustment_reason_id": self.reason_approval.id,
            },
            format="json",
        )
        self.assertEqual(recount_response.status_code, status.HTTP_200_OK)

        self.client.force_authenticate(self.manager)
        resubmit_response = self.client.post(
            reverse(
                "organization-cycle-count-submit",
                kwargs={"organization_id": self.organization.id, "cycle_count_id": cycle_count.id},
            ),
            {},
            format="json",
        )
        self.assertEqual(resubmit_response.status_code, status.HTTP_200_OK)

        cycle_count.refresh_from_db()
        line.refresh_from_db()
        approval.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.COMPLETED)
        self.assertEqual(line.status, CycleCountLineStatus.RECONCILED)
        self.assertEqual(approval.status, CountApprovalStatus.AUTO_APPROVED)
