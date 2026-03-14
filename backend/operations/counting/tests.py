from __future__ import annotations

from datetime import timedelta
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from inventory.models import AdjustmentDirection, InventoryAdjustmentApprovalRule, InventoryAdjustmentReason, InventoryBalance, InventoryMovement, InventoryStatus, MovementType
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLineStatus, CycleCountStatus
from .views import CountApprovalViewSet, CycleCountLineViewSet, CycleCountViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Counting Owner",
        "vip": 1,
        "openid": "counting-openid",
        "appid": "counting-appid",
        "t_code": "counting-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Counting Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "counting-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Counting Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "300 Count St",
        "warehouse_contact": "555-3300",
        "warehouse_manager": "Counting Lead",
        "creator": "creator",
        "openid": "counting-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "STO",
        "zone_name": "Storage",
        "usage": ZoneUsage.STORAGE,
        "sequence": 10,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    zone, _ = Zone.objects.get_or_create(
        warehouse=defaults["warehouse"],
        zone_code=defaults["zone_code"],
        openid=defaults["openid"],
        is_delete=False,
        defaults=defaults,
    )
    return zone


def create_location_type(**overrides: Any) -> LocationType:
    defaults = {
        "type_code": "PALLET",
        "type_name": "Pallet Rack",
        "picking_enabled": True,
        "putaway_enabled": True,
        "allow_mixed_sku": False,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("3.0000"),
        "creator": "creator",
        "openid": "counting-openid",
    }
    defaults.update(overrides)
    location_type, _ = LocationType.objects.get_or_create(
        type_code=defaults["type_code"],
        openid=defaults["openid"],
        is_delete=False,
        defaults=defaults,
    )
    return location_type


def create_location(**overrides: Any) -> Location:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    zone = overrides.pop("zone", None) or create_zone(warehouse=warehouse)
    location_type = overrides.pop("location_type", None) or create_location_type(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "zone": zone,
        "location_type": location_type,
        "location_code": "COUNT-01",
        "location_name": "Count Bin 01",
        "barcode": "COUNT-01",
        "capacity_qty": 100,
        "max_weight": Decimal("250.00"),
        "max_volume": Decimal("1.5000"),
        "pick_sequence": 1,
        "is_pick_face": True,
        "is_locked": False,
        "status": LocationStatus.AVAILABLE,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return Location.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-COUNT-001",
        "goods_desc": "Count Widget",
        "goods_supplier": "Acme",
        "goods_weight": 1,
        "goods_w": 1,
        "goods_d": 1,
        "goods_h": 1,
        "unit_volume": 1,
        "goods_unit": "EA",
        "goods_class": "General",
        "goods_brand": "Acme",
        "goods_color": "Blue",
        "goods_shape": "Box",
        "goods_specs": "Standard",
        "goods_origin": "USA",
        "goods_cost": 10,
        "goods_price": 20,
        "creator": "creator",
        "bar_code": "SKU-COUNT-001",
        "openid": "counting-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


def create_balance(**overrides: Any) -> InventoryBalance:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    location = overrides.pop("location", None) or create_location(warehouse=warehouse)
    goods = overrides.pop("goods", None) or create_goods(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "location": location,
        "goods": goods,
        "stock_status": InventoryStatus.AVAILABLE,
        "lot_number": "LOT-C1",
        "serial_number": "",
        "on_hand_qty": Decimal("10.0000"),
        "allocated_qty": Decimal("0.0000"),
        "hold_qty": Decimal("0.0000"),
        "unit_cost": Decimal("5.0000"),
        "currency": "USD",
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return InventoryBalance.objects.create(**defaults)


def create_adjustment_reason(**overrides: Any) -> InventoryAdjustmentReason:
    defaults = {
        "code": "COUNT_VAR",
        "name": "Count Variance",
        "description": "Cycle count variance adjustment",
        "direction": AdjustmentDirection.BOTH,
        "requires_approval": False,
        "is_active": True,
        "creator": "creator",
        "openid": "counting-openid",
    }
    defaults.update(overrides)
    return InventoryAdjustmentReason.objects.create(**defaults)


def create_adjustment_rule(**overrides: Any) -> InventoryAdjustmentApprovalRule:
    reason = overrides.pop("adjustment_reason", None) or create_adjustment_reason()
    defaults = {
        "adjustment_reason": reason,
        "warehouse": None,
        "minimum_variance_qty": Decimal("2.0000"),
        "approver_role": "StockControl",
        "is_active": True,
        "notes": "Approval required for larger variances",
        "creator": "creator",
        "openid": reason.openid,
    }
    defaults.update(overrides)
    return InventoryAdjustmentApprovalRule.objects.create(**defaults)


class CountingApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="counting-openid", appid="counting-appid")
        self.user = get_user_model().objects.create_user(username="counting-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.stock_control = create_staff(staff_name="Stock Control", staff_type="StockControl")
        self.outbound_operator = create_staff(staff_name="Outbound Worker", staff_type="Outbound")
        self.count_clerk = create_staff(staff_name="Count Clerk", staff_type="Inbound")
        self.recount_clerk = create_staff(staff_name="Recount Clerk", staff_type="Outbound")
        self.warehouse = create_warehouse()
        self.location = create_location(warehouse=self.warehouse)
        self.goods = create_goods(openid=self.warehouse.openid)
        self.balance = create_balance(warehouse=self.warehouse, location=self.location, goods=self.goods)

    def _create_cycle_count(
        self,
        count_number: str = "CC-1001",
        *,
        blind_count: bool = False,
        assigned_to: Staff | None = None,
    ) -> CycleCount:
        view = CycleCountViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/counting/cycle-counts/",
            {
                "warehouse": self.warehouse.pk,
                "count_number": count_number,
                "is_blind_count": blind_count,
                "line_items": [{"inventory_balance": self.balance.pk, "assigned_to": assigned_to.pk if assigned_to else None}],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        return CycleCount.objects.get(count_number=count_number)

    def _update_count_line(
        self,
        *,
        cycle_count: CycleCount,
        counted_qty: str,
        adjustment_reason: InventoryAdjustmentReason | None = None,
        operator: Staff | None = None,
    ) -> None:
        line = cycle_count.lines.get()
        view = CycleCountLineViewSet.as_view({"patch": "partial_update"})
        payload: dict[str, Any] = {"counted_qty": counted_qty}
        if adjustment_reason is not None:
            payload["adjustment_reason"] = adjustment_reason.pk
        request = self.factory.patch(
            f"/api/counting/cycle-count-lines/{line.pk}/",
            payload,
            format="json",
            HTTP_OPERATOR=str((operator or self.operator).id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=line.pk)
        self.assertEqual(response.status_code, 200)

    def _assign_recount(self, *, line_id: int, operator_id: int | None = None, assigned_to: Staff | None = None) -> None:
        view = CycleCountLineViewSet.as_view({"post": "assign_recount"})
        request = self.factory.post(
            f"/api/counting/cycle-count-lines/{line_id}/assign-recount/",
            {"assigned_to": assigned_to.pk if assigned_to else None},
            format="json",
            HTTP_OPERATOR=str(operator_id or self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=line_id)
        self.assertEqual(response.status_code, 200)

    def _record_recount(self, *, line_id: int, counted_qty: str, operator: Staff, adjustment_reason: InventoryAdjustmentReason | None = None) -> None:
        view = CycleCountLineViewSet.as_view({"post": "recount"})
        payload: dict[str, Any] = {"counted_qty": counted_qty}
        if adjustment_reason is not None:
            payload["adjustment_reason"] = adjustment_reason.pk
        request = self.factory.post(
            f"/api/counting/cycle-count-lines/{line_id}/recount/",
            payload,
            format="json",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=line_id)
        self.assertEqual(response.status_code, 200)

    def _scan_lookup(self, *, location: str, sku: str, operator: Staff, recount: bool = False, count_number: str = ""):
        view = CycleCountLineViewSet.as_view({"post": "scan_lookup"})
        payload: dict[str, Any] = {"location": location, "sku": sku, "recount": recount}
        if count_number:
            payload["count_number"] = count_number
        request = self.factory.post(
            "/api/counting/cycle-count-lines/scan-lookup/",
            payload,
            format="json",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        return view(request)

    def _scan_count(
        self,
        *,
        location: str,
        sku: str,
        counted_qty: str,
        operator: Staff,
        recount: bool = False,
        count_number: str = "",
        adjustment_reason: InventoryAdjustmentReason | None = None,
        adjustment_reason_code: str = "",
    ):
        view = CycleCountLineViewSet.as_view({"post": "scan_count"})
        payload: dict[str, Any] = {
            "location": location,
            "sku": sku,
            "counted_qty": counted_qty,
            "recount": recount,
        }
        if count_number:
            payload["count_number"] = count_number
        if adjustment_reason is not None:
            payload["adjustment_reason"] = adjustment_reason.pk
        if adjustment_reason_code:
            payload["adjustment_reason_code"] = adjustment_reason_code
        request = self.factory.post(
            "/api/counting/cycle-count-lines/scan-count/",
            payload,
            format="json",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        return view(request)

    def _next_task(self, *, operator: Staff):
        view = CycleCountLineViewSet.as_view({"get": "next_task"})
        request = self.factory.get(
            "/api/counting/cycle-count-lines/next-task/",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        return view(request)

    def _scanner_task_action(self, *, line_id: int, operator: Staff, action: str):
        view = CycleCountLineViewSet.as_view({"post": action})
        request = self.factory.post(
            f"/api/counting/cycle-count-lines/{line_id}/{action.replace('_', '-')}/",
            {},
            format="json",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        return view(request, pk=line_id)

    def _scanner_complete(
        self,
        *,
        line_id: int,
        operator: Staff,
        counted_qty: str,
        adjustment_reason: InventoryAdjustmentReason | None = None,
        adjustment_reason_code: str = "",
    ):
        view = CycleCountLineViewSet.as_view({"post": "scanner_complete"})
        payload: dict[str, Any] = {"counted_qty": counted_qty}
        if adjustment_reason is not None:
            payload["adjustment_reason"] = adjustment_reason.pk
        if adjustment_reason_code:
            payload["adjustment_reason_code"] = adjustment_reason_code
        request = self.factory.post(
            f"/api/counting/cycle-count-lines/{line_id}/scanner-complete/",
            payload,
            format="json",
            HTTP_OPERATOR=str(operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        return view(request, pk=line_id)

    def test_cycle_count_create_snapshots_balance_lines(self) -> None:
        cycle_count = self._create_cycle_count()
        line = cycle_count.lines.get()
        self.assertEqual(line.system_qty, Decimal("10.0000"))
        self.assertEqual(line.location_id, self.location.id)
        self.assertEqual(line.goods_id, self.goods.id)

    def test_blind_count_assignment_queue_hides_system_qty_for_handheld(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-BLIND", blind_count=True, assigned_to=self.count_clerk)
        line = cycle_count.lines.get()
        self.assertEqual(line.assigned_to_id, self.count_clerk.id)

        assignments_view = CycleCountLineViewSet.as_view({"get": "my_assignments"})
        request = self.factory.get("/api/counting/cycle-count-lines/my-assignments/")
        force_authenticate(request, user=self.user, token=self.auth)
        request.META["HTTP_OPERATOR"] = str(self.count_clerk.id)
        response = assignments_view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertIsNone(response.data["results"][0]["system_qty"])
        self.assertTrue(cycle_count.is_blind_count)

    def test_assigned_operator_can_count_and_other_operator_is_denied(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-ASSIGN", assigned_to=self.count_clerk)
        line = cycle_count.lines.get()

        denied_view = CycleCountLineViewSet.as_view({"patch": "partial_update"})
        denied_request = self.factory.patch(
            f"/api/counting/cycle-count-lines/{line.pk}/",
            {"counted_qty": "9.0000"},
            format="json",
            HTTP_OPERATOR=str(self.outbound_operator.id),
        )
        force_authenticate(denied_request, user=self.user, token=self.auth)
        denied_response = denied_view(denied_request, pk=line.pk)
        self.assertEqual(denied_response.status_code, 403)

        self._update_count_line(cycle_count=cycle_count, counted_qty="9.0000", operator=self.count_clerk)
        line.refresh_from_db()
        self.assertEqual(line.counted_by, self.count_clerk.staff_name)
        self.assertEqual(line.counted_qty, Decimal("9.0000"))

    def test_scan_lookup_returns_blind_assignment_without_system_qty(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-SCAN-LOOKUP", blind_count=True, assigned_to=self.count_clerk)
        response = self._scan_lookup(
            location=self.location.barcode,
            sku=self.goods.bar_code,
            operator=self.count_clerk,
            count_number=cycle_count.count_number,
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cycle_count"], cycle_count.id)
        self.assertEqual(response.data["goods_code"], self.goods.goods_code)
        self.assertIsNone(response.data["system_qty"])

    def test_scan_count_updates_assigned_line_by_barcodes(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-SCAN-COUNT", assigned_to=self.count_clerk)
        response = self._scan_count(
            location=self.location.location_code,
            sku=self.goods.goods_code,
            counted_qty="7.0000",
            operator=self.count_clerk,
            count_number=cycle_count.count_number,
        )
        self.assertEqual(response.status_code, 200)
        line = cycle_count.lines.get()
        line.refresh_from_db()
        self.assertEqual(line.counted_qty, Decimal("7.0000"))
        self.assertEqual(line.counted_by, self.count_clerk.staff_name)

    def test_next_task_returns_open_assignment(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-NEXT-TASK", blind_count=True, assigned_to=self.count_clerk)
        response = self._next_task(operator=self.count_clerk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cycle_count"], cycle_count.id)
        self.assertEqual(response.data["task_type"], "COUNT")
        self.assertIsNone(response.data["system_qty"])

    def test_next_task_prioritizes_recount_before_open_count(self) -> None:
        open_count = self._create_cycle_count(count_number="CC-NEXT-OPEN", assigned_to=self.count_clerk)
        reason = create_adjustment_reason(
            code="COUNT_NEXT_RECOUNT",
            name="Next Recount",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        recount_count = self._create_cycle_count(count_number="CC-NEXT-RECOUNT", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=recount_count, counted_qty="6.0000", adjustment_reason=reason, operator=self.count_clerk)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{recount_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=recount_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        line = recount_count.lines.get()
        approval = CountApproval.objects.get(cycle_count_line=line)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/reject/",
            {"notes": "Prioritize recount"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=approval.pk)
        self.assertEqual(reject_response.status_code, 200)
        self._assign_recount(line_id=line.pk, assigned_to=self.count_clerk)

        response = self._next_task(operator=self.count_clerk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cycle_count"], recount_count.id)
        self.assertEqual(response.data["task_type"], "RECOUNT")
        self.assertNotEqual(response.data["cycle_count"], open_count.id)

    def test_next_task_returns_no_content_when_operator_has_no_assignments(self) -> None:
        response = self._next_task(operator=self.outbound_operator)
        self.assertEqual(response.status_code, 204)

    def test_scanner_ack_start_complete_tracks_task_lifecycle(self) -> None:
        cycle_count = self._create_cycle_count(count_number="CC-SCANNER-LIFECYCLE", blind_count=True, assigned_to=self.count_clerk)
        line = cycle_count.lines.get()

        ack_response = self._scanner_task_action(line_id=line.pk, operator=self.count_clerk, action="scanner_ack")
        self.assertEqual(ack_response.status_code, 200)
        self.assertEqual(ack_response.data["scanner_task_status"], "ACKNOWLEDGED")

        start_response = self._scanner_task_action(line_id=line.pk, operator=self.count_clerk, action="scanner_start")
        self.assertEqual(start_response.status_code, 200)
        self.assertEqual(start_response.data["scanner_task_status"], "IN_PROGRESS")

        complete_response = self._scanner_complete(line_id=line.pk, operator=self.count_clerk, counted_qty="10.0000")
        self.assertEqual(complete_response.status_code, 200)
        self.assertEqual(complete_response.data["scanner_task_status"], "COMPLETED")
        self.assertEqual(complete_response.data["counted_qty"], "10.0000")
        self.assertEqual(complete_response.data["scanner_task_last_operator"], self.count_clerk.staff_name)

    def test_next_task_prioritizes_in_progress_count_before_pending(self) -> None:
        first_count = self._create_cycle_count(count_number="CC-TASK-FIRST", assigned_to=self.count_clerk)
        second_count = self._create_cycle_count(count_number="CC-TASK-SECOND", assigned_to=self.count_clerk)
        second_line = second_count.lines.get()

        ack_response = self._scanner_task_action(line_id=second_line.pk, operator=self.count_clerk, action="scanner_ack")
        self.assertEqual(ack_response.status_code, 200)
        start_response = self._scanner_task_action(line_id=second_line.pk, operator=self.count_clerk, action="scanner_start")
        self.assertEqual(start_response.status_code, 200)

        response = self._next_task(operator=self.count_clerk)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["cycle_count"], second_count.id)
        self.assertEqual(response.data["scanner_task_status"], "IN_PROGRESS")
        self.assertNotEqual(response.data["cycle_count"], first_count.id)

    def test_submit_cycle_count_auto_applies_small_variance(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_LOSS",
            name="Count Loss",
            direction=AdjustmentDirection.DECREASE,
            openid=self.warehouse.openid,
        )
        cycle_count = self._create_cycle_count(count_number="CC-2001")
        self._update_count_line(cycle_count=cycle_count, counted_qty="8.0000", adjustment_reason=reason)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        cycle_count.refresh_from_db()
        line = cycle_count.lines.get()
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.COMPLETED)
        self.assertEqual(line.status, CycleCountLineStatus.RECONCILED)
        self.assertEqual(self.balance.on_hand_qty, Decimal("8.0000"))
        self.assertEqual(line.approval.status, CountApprovalStatus.AUTO_APPROVED)
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.ADJUSTMENT_OUT).count(), 1)

    def test_submit_cycle_count_creates_pending_approval_and_approve_applies_adjustment(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_GAIN",
            name="Count Gain",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
        )
        create_adjustment_rule(adjustment_reason=reason, warehouse=self.warehouse, openid=self.warehouse.openid)
        cycle_count = self._create_cycle_count(count_number="CC-3001")
        self._update_count_line(cycle_count=cycle_count, counted_qty="13.0000", adjustment_reason=reason)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        cycle_count.refresh_from_db()
        line = cycle_count.lines.get()
        approval = CountApproval.objects.get(cycle_count_line=line)
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.PENDING_APPROVAL)
        self.assertEqual(line.status, CycleCountLineStatus.PENDING_APPROVAL)
        self.assertEqual(approval.status, CountApprovalStatus.PENDING)
        self.assertEqual(self.balance.on_hand_qty, Decimal("10.0000"))

        approve_view = CountApprovalViewSet.as_view({"post": "approve"})
        approve_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/approve/",
            {"notes": "Variance confirmed"},
            format="json",
            HTTP_OPERATOR=str(self.stock_control.id),
        )
        force_authenticate(approve_request, user=self.user, token=self.auth)
        approve_response = approve_view(approve_request, pk=approval.pk)
        self.assertEqual(approve_response.status_code, 200)

        cycle_count.refresh_from_db()
        line.refresh_from_db()
        approval.refresh_from_db()
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.COMPLETED)
        self.assertEqual(line.status, CycleCountLineStatus.RECONCILED)
        self.assertEqual(approval.status, CountApprovalStatus.APPROVED)
        self.assertEqual(self.balance.on_hand_qty, Decimal("13.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.ADJUSTMENT_IN).count(), 1)

    def test_reject_variance_marks_cycle_count_rejected(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_CHECK",
            name="Count Check",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        cycle_count = self._create_cycle_count(count_number="CC-4001")
        self._update_count_line(cycle_count=cycle_count, counted_qty="6.0000", adjustment_reason=reason)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        approval = CountApproval.objects.get(cycle_count_line=cycle_count.lines.get())
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/reject/",
            {"notes": "Recount required"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=approval.pk)
        self.assertEqual(reject_response.status_code, 200)

        cycle_count.refresh_from_db()
        approval.refresh_from_db()
        line = cycle_count.lines.get()
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.REJECTED)
        self.assertEqual(line.status, CycleCountLineStatus.REJECTED)
        self.assertEqual(approval.status, CountApprovalStatus.REJECTED)
        self.assertEqual(self.balance.on_hand_qty, Decimal("10.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type__in=[MovementType.ADJUSTMENT_IN, MovementType.ADJUSTMENT_OUT]).count(), 0)

    def test_recount_assignment_and_resubmission_complete_cycle_count(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_RECOUNT",
            name="Count Recount",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        cycle_count = self._create_cycle_count(count_number="CC-RECOUNT", blind_count=True)
        self._update_count_line(cycle_count=cycle_count, counted_qty="6.0000", adjustment_reason=reason, operator=self.count_clerk)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        line = cycle_count.lines.get()
        approval = CountApproval.objects.get(cycle_count_line=line)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/reject/",
            {"notes": "Recount the location"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=approval.pk)
        self.assertEqual(reject_response.status_code, 200)

        self._assign_recount(line_id=line.pk, assigned_to=self.recount_clerk)
        line.refresh_from_db()
        self.assertEqual(line.status, "RECOUNT_ASSIGNED")
        self.assertEqual(line.recount_assigned_to_id, self.recount_clerk.id)

        assignments_view = CycleCountLineViewSet.as_view({"get": "my_assignments"})
        assignments_request = self.factory.get("/api/counting/cycle-count-lines/my-assignments/")
        assignments_request.META["HTTP_OPERATOR"] = str(self.recount_clerk.id)
        force_authenticate(assignments_request, user=self.user, token=self.auth)
        assignments_response = assignments_view(assignments_request)
        self.assertEqual(assignments_response.status_code, 200)
        self.assertEqual(assignments_response.data["count"], 1)
        self.assertIsNone(assignments_response.data["results"][0]["system_qty"])

        self._record_recount(line_id=line.pk, counted_qty="10.0000", operator=self.recount_clerk, adjustment_reason=reason)
        line.refresh_from_db()
        self.assertEqual(line.recount_counted_qty, Decimal("10.0000"))
        self.assertEqual(line.recounted_by, self.recount_clerk.staff_name)

        resubmit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(resubmit_request, user=self.user, token=self.auth)
        resubmit_response = submit_view(resubmit_request, pk=cycle_count.pk)
        self.assertEqual(resubmit_response.status_code, 200)

        cycle_count.refresh_from_db()
        line.refresh_from_db()
        approval.refresh_from_db()
        self.balance.refresh_from_db()
        self.assertEqual(cycle_count.status, CycleCountStatus.COMPLETED)
        self.assertEqual(line.status, CycleCountLineStatus.RECONCILED)
        self.assertEqual(approval.status, CountApprovalStatus.AUTO_APPROVED)
        self.assertEqual(self.balance.on_hand_qty, Decimal("10.0000"))

    def test_scan_count_supports_recount_with_reason_code(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_SCAN_RECOUNT",
            name="Scan Recount",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        cycle_count = self._create_cycle_count(count_number="CC-SCAN-RECOUNT", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=cycle_count, counted_qty="6.0000", adjustment_reason=reason, operator=self.count_clerk)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        line = cycle_count.lines.get()
        approval = CountApproval.objects.get(cycle_count_line=line)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/reject/",
            {"notes": "Scan recount required"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=approval.pk)
        self.assertEqual(reject_response.status_code, 200)

        self._assign_recount(line_id=line.pk, assigned_to=self.recount_clerk)
        response = self._scan_count(
            location=self.location.barcode,
            sku=self.goods.bar_code,
            counted_qty="10.0000",
            operator=self.recount_clerk,
            recount=True,
            count_number=cycle_count.count_number,
            adjustment_reason_code=reason.code,
        )
        self.assertEqual(response.status_code, 200)
        line.refresh_from_db()
        self.assertEqual(line.recount_counted_qty, Decimal("10.0000"))
        self.assertEqual(line.recounted_by, self.recount_clerk.staff_name)

    def test_supervisor_queue_and_summary_surface_pending_and_rejected_variances(self) -> None:
        pending_reason = create_adjustment_reason(
            code="COUNT_PENDING",
            name="Count Pending",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
        )
        rejected_reason = create_adjustment_reason(
            code="COUNT_REJECTED",
            name="Count Rejected",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        create_adjustment_rule(
            adjustment_reason=pending_reason,
            warehouse=self.warehouse,
            openid=self.warehouse.openid,
            minimum_variance_qty=Decimal("2.0000"),
            approver_role="StockControl",
        )

        pending_count = self._create_cycle_count(count_number="CC-PENDING")
        self._update_count_line(cycle_count=pending_count, counted_qty="13.0000", adjustment_reason=pending_reason)
        rejected_count = self._create_cycle_count(count_number="CC-REJECTED")
        self._update_count_line(cycle_count=rejected_count, counted_qty="6.0000", adjustment_reason=rejected_reason)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        for cycle_count in (pending_count, rejected_count):
            submit_request = self.factory.post(
                f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
                {},
                format="json",
                HTTP_OPERATOR=str(self.operator.id),
            )
            force_authenticate(submit_request, user=self.user, token=self.auth)
            submit_response = submit_view(submit_request, pk=cycle_count.pk)
            self.assertEqual(submit_response.status_code, 200)

        rejected_approval = CountApproval.objects.get(cycle_count_line__cycle_count=rejected_count)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{rejected_approval.pk}/reject/",
            {"notes": "Need recount"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=rejected_approval.pk)
        self.assertEqual(reject_response.status_code, 200)

        queue_view = CountApprovalViewSet.as_view({"get": "queue"})
        queue_request = self.factory.get("/api/counting/approvals/queue/")
        queue_request.META["HTTP_OPERATOR"] = str(self.stock_control.id)
        force_authenticate(queue_request, user=self.user, token=self.auth)
        queue_response = queue_view(queue_request)
        self.assertEqual(queue_response.status_code, 200)
        self.assertEqual(queue_response.data["count"], 2)

        summary_view = CountApprovalViewSet.as_view({"get": "summary"})
        summary_request = self.factory.get("/api/counting/approvals/summary/")
        summary_request.META["HTTP_OPERATOR"] = str(self.stock_control.id)
        force_authenticate(summary_request, user=self.user, token=self.auth)
        summary_response = summary_view(summary_request)
        self.assertEqual(summary_response.status_code, 200)
        self.assertEqual(summary_response.data["pending_count"], 1)
        self.assertEqual(summary_response.data["rejected_count"], 1)

    def test_supervisor_dashboard_surfaces_pending_aging_and_recount_sla_breaches(self) -> None:
        pending_reason = create_adjustment_reason(
            code="COUNT_DASH_PENDING",
            name="Dashboard Pending",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        rejected_reason = create_adjustment_reason(
            code="COUNT_DASH_REJECTED",
            name="Dashboard Rejected",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )

        pending_count = self._create_cycle_count(count_number="CC-DASH-PENDING", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=pending_count, counted_qty="14.0000", adjustment_reason=pending_reason, operator=self.count_clerk)
        rejected_count = self._create_cycle_count(count_number="CC-DASH-REJECTED", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=rejected_count, counted_qty="6.0000", adjustment_reason=rejected_reason, operator=self.count_clerk)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        for cycle_count in (pending_count, rejected_count):
            submit_request = self.factory.post(
                f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
                {},
                format="json",
                HTTP_OPERATOR=str(self.operator.id),
            )
            force_authenticate(submit_request, user=self.user, token=self.auth)
            submit_response = submit_view(submit_request, pk=cycle_count.pk)
            self.assertEqual(submit_response.status_code, 200)

        rejected_line = rejected_count.lines.get()
        rejected_approval = CountApproval.objects.get(cycle_count_line=rejected_line)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{rejected_approval.pk}/reject/",
            {"notes": "Supervisor wants recount"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=rejected_approval.pk)
        self.assertEqual(reject_response.status_code, 200)
        self._assign_recount(line_id=rejected_line.pk, assigned_to=self.recount_clerk)

        stale_time = timezone.now() - timedelta(hours=30)
        CountApproval.objects.filter(cycle_count_line__cycle_count=pending_count).update(requested_at=stale_time)
        CountApproval.objects.filter(pk=rejected_approval.pk).update(rejected_at=timezone.now() - timedelta(hours=12))
        CycleCountLineStatusModel = rejected_line.__class__
        CycleCountLineStatusModel.objects.filter(pk=rejected_line.pk).update(recount_assigned_at=timezone.now() - timedelta(hours=9))

        dashboard_view = CountApprovalViewSet.as_view({"get": "dashboard"})
        dashboard_request = self.factory.get(
            "/api/counting/approvals/dashboard/?pending_sla_hours=24&recount_sla_hours=8&limit=5"
        )
        dashboard_request.META["HTTP_OPERATOR"] = str(self.stock_control.id)
        force_authenticate(dashboard_request, user=self.user, token=self.auth)
        dashboard_response = dashboard_view(dashboard_request)
        self.assertEqual(dashboard_response.status_code, 200)
        self.assertEqual(dashboard_response.data["pending_variances"]["count"], 1)
        self.assertEqual(dashboard_response.data["pending_variances"]["sla_breach_count"], 1)
        self.assertEqual(dashboard_response.data["recount_breaches"]["open_count"], 1)
        self.assertEqual(dashboard_response.data["recount_breaches"]["sla_breach_count"], 1)
        self.assertEqual(dashboard_response.data["recount_breaches"]["overdue_items"][0]["count_number"], rejected_count.count_number)

    def test_supervisor_dashboard_export_streams_csv_rows(self) -> None:
        pending_reason = create_adjustment_reason(
            code="COUNT_EXPORT_PENDING",
            name="Export Pending",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )
        rejected_reason = create_adjustment_reason(
            code="COUNT_EXPORT_RECOUNT",
            name="Export Recount",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
            requires_approval=True,
        )

        pending_count = self._create_cycle_count(count_number="CC-EXPORT-PENDING", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=pending_count, counted_qty="14.0000", adjustment_reason=pending_reason, operator=self.count_clerk)
        recount_count = self._create_cycle_count(count_number="CC-EXPORT-RECOUNT", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=recount_count, counted_qty="6.0000", adjustment_reason=rejected_reason, operator=self.count_clerk)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        for cycle_count in (pending_count, recount_count):
            submit_request = self.factory.post(
                f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
                {},
                format="json",
                HTTP_OPERATOR=str(self.operator.id),
            )
            force_authenticate(submit_request, user=self.user, token=self.auth)
            submit_response = submit_view(submit_request, pk=cycle_count.pk)
            self.assertEqual(submit_response.status_code, 200)

        recount_line = recount_count.lines.get()
        recount_approval = CountApproval.objects.get(cycle_count_line=recount_line)
        reject_view = CountApprovalViewSet.as_view({"post": "reject"})
        reject_request = self.factory.post(
            f"/api/counting/approvals/{recount_approval.pk}/reject/",
            {"notes": "Export recount breach"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(reject_request, user=self.user, token=self.auth)
        reject_response = reject_view(reject_request, pk=recount_approval.pk)
        self.assertEqual(reject_response.status_code, 200)
        self._assign_recount(line_id=recount_line.pk, assigned_to=self.recount_clerk)

        CountApproval.objects.filter(cycle_count_line__cycle_count=pending_count).update(
            requested_at=timezone.now() - timedelta(hours=30)
        )
        recount_line.__class__.objects.filter(pk=recount_line.pk).update(
            recount_assigned_at=timezone.now() - timedelta(hours=9)
        )

        export_view = CountApprovalViewSet.as_view({"get": "dashboard_export"})
        export_request = self.factory.get(
            "/api/counting/approvals/dashboard/export/?pending_sla_hours=24&recount_sla_hours=8&scope=all",
            HTTP_OPERATOR=str(self.stock_control.id),
            HTTP_LANGUAGE="en-us",
        )
        force_authenticate(export_request, user=self.user, token=self.auth)
        export_response = export_view(export_request)
        self.assertEqual(export_response.status_code, 200)
        self.assertEqual(export_response["Content-Type"], "text/csv")
        self.assertIn("counting_dashboard_", export_response["Content-Disposition"])
        content = b"".join(
            chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")
            for chunk in export_response.streaming_content
        ).decode("utf-8")
        self.assertIn("Record Type", content)
        self.assertIn("PENDING_VARIANCE", content)
        self.assertIn("RECOUNT_BREACH", content)

    def test_dashboard_export_filters_by_warehouse_and_approver_role(self) -> None:
        primary_reason = create_adjustment_reason(
            code="COUNT_EXPORT_ROLE",
            name="Export Role",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
        )
        secondary_warehouse = create_warehouse(
            warehouse_name="Secondary Warehouse",
            warehouse_city="Boston",
            warehouse_address="400 Filter St",
            warehouse_contact="555-4400",
            warehouse_manager="Second Lead",
        )
        secondary_location = create_location(
            warehouse=secondary_warehouse,
            zone=create_zone(warehouse=secondary_warehouse, zone_code="ST2", zone_name="Storage 2", openid=secondary_warehouse.openid),
            location_type=create_location_type(type_code="PALLET-2", openid=secondary_warehouse.openid),
            location_code="COUNT-02",
            barcode="COUNT-02",
            openid=secondary_warehouse.openid,
        )
        secondary_goods = create_goods(goods_code="SKU-COUNT-002", bar_code="SKU-COUNT-002", openid=secondary_warehouse.openid)
        secondary_balance = create_balance(
            warehouse=secondary_warehouse,
            location=secondary_location,
            goods=secondary_goods,
            openid=secondary_warehouse.openid,
        )
        stock_control_reason = create_adjustment_reason(
            code="COUNT_EXPORT_STOCK",
            name="Export Stock Control",
            direction=AdjustmentDirection.BOTH,
            openid=secondary_warehouse.openid,
        )
        create_adjustment_rule(
            adjustment_reason=stock_control_reason,
            warehouse=secondary_warehouse,
            openid=secondary_warehouse.openid,
            approver_role="StockControl",
        )

        primary_count = self._create_cycle_count(count_number="CC-FILTER-PRIMARY", assigned_to=self.count_clerk)
        self._update_count_line(cycle_count=primary_count, counted_qty="13.0000", adjustment_reason=primary_reason)

        secondary_count = CycleCount.objects.create(
            warehouse=secondary_warehouse,
            count_number="CC-FILTER-SECONDARY",
            creator=self.operator.staff_name,
            openid=secondary_warehouse.openid,
        )
        secondary_line = secondary_count.lines.create(
            line_number=1,
            inventory_balance=secondary_balance,
            location=secondary_location,
            goods=secondary_goods,
            stock_status=secondary_balance.stock_status,
            lot_number=secondary_balance.lot_number,
            serial_number=secondary_balance.serial_number,
            system_qty=secondary_balance.on_hand_qty,
            assigned_to=self.count_clerk,
            assigned_at=timezone.now(),
            scanner_task_type="COUNT",
            scanner_task_status="PENDING",
            creator=self.operator.staff_name,
            openid=secondary_warehouse.openid,
        )
        secondary_line.counted_qty = Decimal("14.0000")
        secondary_line.variance_qty = Decimal("4.0000")
        secondary_line.adjustment_reason = stock_control_reason
        secondary_line.status = CycleCountLineStatus.COUNTED
        secondary_line.counted_by = self.count_clerk.staff_name
        secondary_line.counted_at = timezone.now()
        secondary_line.save(
            update_fields=[
                "counted_qty",
                "variance_qty",
                "adjustment_reason",
                "status",
                "counted_by",
                "counted_at",
                "update_time",
            ]
        )
        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        primary_submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{primary_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(primary_submit_request, user=self.user, token=self.auth)
        primary_submit_response = submit_view(primary_submit_request, pk=primary_count.pk)
        self.assertEqual(primary_submit_response.status_code, 200)

        secondary_submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{secondary_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(secondary_submit_request, user=self.user, token=self.auth)
        secondary_submit_response = submit_view(secondary_submit_request, pk=secondary_count.pk)
        self.assertEqual(secondary_submit_response.status_code, 200)

        export_view = CountApprovalViewSet.as_view({"get": "dashboard_export"})
        export_request = self.factory.get(
            f"/api/counting/approvals/dashboard/export/?scope=pending&warehouse={secondary_warehouse.id}&approver_role=StockControl",
            HTTP_OPERATOR=str(self.stock_control.id),
            HTTP_LANGUAGE="en-us",
        )
        force_authenticate(export_request, user=self.user, token=self.auth)
        export_response = export_view(export_request)
        self.assertEqual(export_response.status_code, 200)
        content = b"".join(
            chunk if isinstance(chunk, bytes) else chunk.encode("utf-8")
            for chunk in export_response.streaming_content
        ).decode("utf-8")
        self.assertIn("CC-FILTER-SECONDARY", content)
        self.assertNotIn("CC-FILTER-PRIMARY", content)

    def test_approval_requires_matching_role(self) -> None:
        reason = create_adjustment_reason(
            code="COUNT_ROLE",
            name="Count Role",
            direction=AdjustmentDirection.BOTH,
            openid=self.warehouse.openid,
        )
        create_adjustment_rule(adjustment_reason=reason, warehouse=self.warehouse, openid=self.warehouse.openid)
        cycle_count = self._create_cycle_count(count_number="CC-5001")
        self._update_count_line(cycle_count=cycle_count, counted_qty="13.0000", adjustment_reason=reason)

        submit_view = CycleCountViewSet.as_view({"post": "submit"})
        submit_request = self.factory.post(
            f"/api/counting/cycle-counts/{cycle_count.pk}/submit/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(submit_request, user=self.user, token=self.auth)
        submit_response = submit_view(submit_request, pk=cycle_count.pk)
        self.assertEqual(submit_response.status_code, 200)

        approval = CountApproval.objects.get(cycle_count_line=cycle_count.lines.get())
        approve_view = CountApprovalViewSet.as_view({"post": "approve"})
        approve_request = self.factory.post(
            f"/api/counting/approvals/{approval.pk}/approve/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.outbound_operator.id),
        )
        force_authenticate(approve_request, user=self.user, token=self.auth)
        approve_response = approve_view(approve_request, pk=approval.pk)
        self.assertEqual(approve_response.status_code, 403)


class CountingUrlsTests(TestCase):
    def test_routes_match_expected_paths(self) -> None:
        self.assertEqual(reverse("counting:cycle-count-list"), "/api/counting/cycle-counts/")
        self.assertEqual(reverse("counting:cycle-count-submit", kwargs={"pk": 1}), "/api/counting/cycle-counts/1/submit/")
        self.assertEqual(reverse("counting:cycle-count-line-my-assignments"), "/api/counting/cycle-count-lines/my-assignments/")
        self.assertEqual(reverse("counting:cycle-count-line-next-task"), "/api/counting/cycle-count-lines/next-task/")
        self.assertEqual(reverse("counting:cycle-count-line-scan-lookup"), "/api/counting/cycle-count-lines/scan-lookup/")
        self.assertEqual(reverse("counting:cycle-count-line-scan-count"), "/api/counting/cycle-count-lines/scan-count/")
        self.assertEqual(reverse("counting:cycle-count-line-scanner-ack", kwargs={"pk": 1}), "/api/counting/cycle-count-lines/1/scanner-ack/")
        self.assertEqual(reverse("counting:cycle-count-line-scanner-start", kwargs={"pk": 1}), "/api/counting/cycle-count-lines/1/scanner-start/")
        self.assertEqual(reverse("counting:cycle-count-line-scanner-complete", kwargs={"pk": 1}), "/api/counting/cycle-count-lines/1/scanner-complete/")
        self.assertEqual(reverse("counting:cycle-count-line-recount", kwargs={"pk": 1}), "/api/counting/cycle-count-lines/1/recount/")
        self.assertEqual(reverse("counting:approval-queue"), "/api/counting/approvals/queue/")
        self.assertEqual(reverse("counting:approval-summary"), "/api/counting/approvals/summary/")
        self.assertEqual(reverse("counting:approval-dashboard"), "/api/counting/approvals/dashboard/")
        self.assertEqual(reverse("counting:approval-dashboard-export"), "/api/counting/approvals/dashboard/export/")
        self.assertEqual(reverse("counting:approval-approve", kwargs={"pk": 1}), "/api/counting/approvals/1/approve/")
        self.assertEqual(resolve("/api/counting/cycle-count-lines/").url_name, "cycle-count-line-list")
