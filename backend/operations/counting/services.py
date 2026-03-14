"""Domain services for cycle counts, variance reviews, and approvals."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone
from rest_framework.exceptions import APIException, PermissionDenied

from inventory.models import InventoryAdjustmentReason, InventoryBalance
from inventory.services import (
    apply_inventory_adjustment,
    ensure_adjustment_reason_usable,
    ensure_tenant_match,
    find_adjustment_approval_rule,
    operator_can_approve_adjustment,
)
from staff.models import ListModel as Staff
from warehouse.models import Warehouse

from .models import (
    CountApproval,
    CountApprovalStatus,
    CycleCount,
    CycleCountLine,
    CycleCountLineStatus,
    CycleCountStatus,
    ScannerTaskStatus,
    ScannerTaskType,
)

ZERO = Decimal("0.0000")
DEFAULT_APPROVER_ROLE = "Manager"
SUPERVISOR_OVERRIDE_ROLES = {"Manager", "Supervisor", "StockControl"}


@dataclass(frozen=True)
class CycleCountLinePayload:
    inventory_balance: InventoryBalance
    assigned_to: Staff | None = None


@dataclass(frozen=True)
class CycleCountLineUpdatePayload:
    counted_qty: Decimal | None
    adjustment_reason: InventoryAdjustmentReason | None
    notes: str


@dataclass(frozen=True)
class ApprovalDecisionPayload:
    notes: str


@dataclass(frozen=True)
class AssignmentPayload:
    assigned_to: Staff | None


@dataclass(frozen=True)
class ScanLookupPayload:
    location: str
    sku: str
    count_number: str = ""
    recount: bool = False


def _current_task_type(line: CycleCountLine) -> str:
    if line.status == CycleCountLineStatus.RECOUNT_ASSIGNED and line.recount_assigned_to_id:
        return ScannerTaskType.RECOUNT
    if line.status == CycleCountLineStatus.OPEN and line.assigned_to_id:
        return ScannerTaskType.COUNT
    return ScannerTaskType.NONE


def _reset_scanner_task(line: CycleCountLine, *, task_type: str) -> None:
    if task_type == ScannerTaskType.NONE:
        line.scanner_task_type = ScannerTaskType.NONE
        line.scanner_task_status = ScannerTaskStatus.UNASSIGNED
    else:
        line.scanner_task_type = task_type
        line.scanner_task_status = ScannerTaskStatus.PENDING
    line.scanner_task_acknowledged_at = None
    line.scanner_task_started_at = None
    line.scanner_task_completed_at = None
    line.scanner_task_last_operator = ""


def _complete_scanner_task(line: CycleCountLine, *, operator_name: str, task_type: str) -> None:
    if task_type == ScannerTaskType.NONE:
        return
    now = timezone.now()
    line.scanner_task_type = task_type
    line.scanner_task_status = ScannerTaskStatus.COMPLETED
    line.scanner_task_acknowledged_at = line.scanner_task_acknowledged_at or now
    line.scanner_task_started_at = line.scanner_task_started_at or now
    line.scanner_task_completed_at = now
    line.scanner_task_last_operator = operator_name


def _effective_scanner_task_status(line: CycleCountLine) -> str:
    if line.scanner_task_status != ScannerTaskStatus.UNASSIGNED:
        return line.scanner_task_status
    return ScannerTaskStatus.PENDING if _current_task_type(line) != ScannerTaskType.NONE else ScannerTaskStatus.UNASSIGNED


def _task_sort_key(line: CycleCountLine) -> tuple[int, object, object, int, int]:
    status_priority = {
        ScannerTaskStatus.IN_PROGRESS: 0,
        ScannerTaskStatus.ACKNOWLEDGED: 1,
        ScannerTaskStatus.PENDING: 2,
        ScannerTaskStatus.UNASSIGNED: 2,
        ScannerTaskStatus.COMPLETED: 3,
    }
    effective_status = _effective_scanner_task_status(line)
    reference_time = (
        line.scanner_task_started_at
        or line.scanner_task_acknowledged_at
        or line.recount_assigned_at
        or line.assigned_at
        or line.create_time
    )
    scheduled_date = line.cycle_count.scheduled_date or line.create_time.date()
    return (
        status_priority.get(effective_status, 99),
        reference_time,
        scheduled_date,
        line.cycle_count_id,
        line.line_number,
    )


def _resolve_scanner_task(line: CycleCountLine) -> tuple[bool, str]:
    task_type = _current_task_type(line)
    if task_type == ScannerTaskType.RECOUNT:
        return True, task_type
    if task_type == ScannerTaskType.COUNT:
        return False, task_type
    raise APIException({"detail": "This count line does not have an active handheld task"})


def _reconcile_line_status(line: CycleCountLine) -> str:
    if line.status == CycleCountLineStatus.CANCELLED:
        return CycleCountLineStatus.CANCELLED
    if line.status == CycleCountLineStatus.REJECTED:
        return CycleCountLineStatus.REJECTED
    if line.status == CycleCountLineStatus.PENDING_APPROVAL:
        return CycleCountLineStatus.PENDING_APPROVAL
    if line.counted_qty is None:
        return CycleCountLineStatus.OPEN
    return CycleCountLineStatus.COUNTED


def refresh_cycle_count_status(cycle_count: CycleCount) -> CycleCount:
    lines = list(cycle_count.lines.filter(is_delete=False))
    if not lines:
        cycle_count.status = CycleCountStatus.CANCELLED if cycle_count.status == CycleCountStatus.CANCELLED else CycleCountStatus.OPEN
        cycle_count.completed_at = None
    elif any(line.status == CycleCountLineStatus.RECOUNT_ASSIGNED for line in lines):
        cycle_count.status = CycleCountStatus.RECOUNT_IN_PROGRESS
        cycle_count.completed_at = None
    elif any(line.status == CycleCountLineStatus.REJECTED for line in lines):
        cycle_count.status = CycleCountStatus.REJECTED
        cycle_count.completed_at = None
    elif any(line.status == CycleCountLineStatus.PENDING_APPROVAL for line in lines):
        cycle_count.status = CycleCountStatus.PENDING_APPROVAL
        cycle_count.completed_at = None
    elif all(line.status == CycleCountLineStatus.RECONCILED for line in lines):
        cycle_count.status = CycleCountStatus.COMPLETED
        if cycle_count.completed_at is None:
            cycle_count.completed_at = timezone.now()
    elif all(line.counted_qty is not None for line in lines):
        cycle_count.status = CycleCountStatus.COUNTED
        cycle_count.completed_at = None
    else:
        cycle_count.status = CycleCountStatus.OPEN
        cycle_count.completed_at = None
    cycle_count.save(update_fields=["status", "completed_at", "update_time"])
    return cycle_count


@transaction.atomic
def create_cycle_count(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    count_number: str,
    scheduled_date,
    is_blind_count: bool,
    notes: str,
    line_items: Iterable[CycleCountLinePayload],
) -> CycleCount:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "Cycle counts require at least one inventory balance"})

    cycle_count = CycleCount.objects.create(
        warehouse=warehouse,
        count_number=count_number,
        scheduled_date=scheduled_date,
        is_blind_count=is_blind_count,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    used_balance_ids: set[int] = set()
    for line_number, payload in enumerate(line_items, start=1):
        balance = payload.inventory_balance
        ensure_tenant_match(balance, openid, "Inventory balance")
        if balance.warehouse_id != warehouse.id:
            raise APIException({"detail": "All count lines must belong to the selected warehouse"})
        if balance.id in used_balance_ids:
            raise APIException({"detail": "Cycle counts cannot include the same inventory balance twice"})
        used_balance_ids.add(balance.id)
        assigned_to = payload.assigned_to
        if assigned_to is not None:
            ensure_tenant_match(assigned_to, openid, "Assigned staff")
            if assigned_to.is_lock:
                raise APIException({"detail": "Assigned operator is locked"})
        CycleCountLine.objects.create(
            cycle_count=cycle_count,
            line_number=line_number,
            inventory_balance=balance,
            location=balance.location,
            goods=balance.goods,
            stock_status=balance.stock_status,
            lot_number=balance.lot_number,
            serial_number=balance.serial_number,
            system_qty=balance.on_hand_qty,
            assigned_to=assigned_to,
            assigned_at=timezone.now() if assigned_to is not None else None,
            scanner_task_type=ScannerTaskType.COUNT if assigned_to is not None else ScannerTaskType.NONE,
            scanner_task_status=ScannerTaskStatus.PENDING if assigned_to is not None else ScannerTaskStatus.UNASSIGNED,
            creator=operator_name,
            openid=openid,
        )
    return cycle_count


def _ensure_line_operator_access(*, line: CycleCountLine, operator: Staff, recount: bool) -> None:
    assignee = line.recount_assigned_to if recount else line.assigned_to
    if assignee is None:
        return
    if operator.id == assignee.id:
        return
    if operator.staff_type in SUPERVISOR_OVERRIDE_ROLES:
        return
    raise PermissionDenied({"detail": "This count line is assigned to a different operator"})


def _assigned_line_queryset(*, openid: str, operator: Staff, recount: bool):
    queryset = CycleCountLine.objects.select_related(
        "cycle_count",
        "inventory_balance",
        "location",
        "goods",
        "adjustment_reason",
        "adjustment_movement",
        "assigned_to",
        "approval",
        "approval__approval_rule",
        "recount_assigned_to",
    ).filter(
        openid=openid,
        is_delete=False,
        cycle_count__is_delete=False,
        goods__is_delete=False,
        location__is_delete=False,
    )
    if recount:
        return queryset.filter(recount_assigned_to=operator, status=CycleCountLineStatus.RECOUNT_ASSIGNED)
    return queryset.filter(assigned_to=operator, status__in=[CycleCountLineStatus.OPEN, CycleCountLineStatus.COUNTED])


def find_cycle_count_line_by_scan(
    *,
    openid: str,
    operator: Staff,
    payload: ScanLookupPayload,
) -> CycleCountLine:
    queryset = _assigned_line_queryset(openid=openid, operator=operator, recount=payload.recount).filter(
        Q(location__barcode=payload.location) | Q(location__location_code=payload.location),
        Q(goods__bar_code=payload.sku) | Q(goods__goods_code=payload.sku),
    )
    if payload.count_number:
        queryset = queryset.filter(cycle_count__count_number=payload.count_number)

    matches = list(queryset.order_by("cycle_count__scheduled_date", "cycle_count_id", "line_number")[:2])
    if not matches:
        raise APIException({"detail": "No assigned count line matches the scanned location and SKU"})
    if len(matches) > 1:
        raise APIException({"detail": "Scanned location and SKU match multiple assigned count lines. Provide count_number to disambiguate."})
    return matches[0]


def get_next_assigned_cycle_count_line(*, openid: str, operator: Staff) -> tuple[CycleCountLine | None, str | None]:
    recount_candidates = list(_assigned_line_queryset(openid=openid, operator=operator, recount=True))
    recount_candidates = [
        line for line in recount_candidates if _effective_scanner_task_status(line) != ScannerTaskStatus.COMPLETED
    ]
    recount_line = min(recount_candidates, key=_task_sort_key) if recount_candidates else None
    if recount_line is not None:
        return recount_line, "RECOUNT"

    count_candidates = list(
        CycleCountLine.objects.select_related(
            "cycle_count",
            "inventory_balance",
            "location",
            "goods",
            "adjustment_reason",
            "adjustment_movement",
            "assigned_to",
            "approval",
            "approval__approval_rule",
            "recount_assigned_to",
        )
        .filter(
            openid=openid,
            is_delete=False,
            cycle_count__is_delete=False,
            goods__is_delete=False,
            location__is_delete=False,
            assigned_to=operator,
            status=CycleCountLineStatus.OPEN,
        )
    )
    count_candidates = [
        line for line in count_candidates if _effective_scanner_task_status(line) != ScannerTaskStatus.COMPLETED
    ]
    count_line = min(count_candidates, key=_task_sort_key) if count_candidates else None
    if count_line is not None:
        return count_line, "COUNT"
    return None, None


@transaction.atomic
def transition_scanner_task(
    *,
    openid: str,
    operator: Staff,
    cycle_count_line: CycleCountLine,
    action: str,
) -> CycleCountLine:
    ensure_tenant_match(cycle_count_line, openid, "Cycle count line")
    line = (
        CycleCountLine.objects.select_for_update()
        .select_related("cycle_count", "assigned_to", "recount_assigned_to")
        .get(pk=cycle_count_line.pk)
    )
    recount, task_type = _resolve_scanner_task(line)
    _ensure_line_operator_access(line=line, operator=operator, recount=recount)
    effective_status = _effective_scanner_task_status(line)
    if effective_status == ScannerTaskStatus.COMPLETED:
        raise APIException({"detail": "Completed handheld tasks cannot transition again"})

    now = timezone.now()
    if action == "ack":
        if effective_status == ScannerTaskStatus.PENDING:
            line.scanner_task_acknowledged_at = line.scanner_task_acknowledged_at or now
            line.scanner_task_status = ScannerTaskStatus.ACKNOWLEDGED
    elif action == "start":
        if effective_status in {ScannerTaskStatus.PENDING, ScannerTaskStatus.ACKNOWLEDGED}:
            line.scanner_task_acknowledged_at = line.scanner_task_acknowledged_at or now
            line.scanner_task_started_at = line.scanner_task_started_at or now
            line.scanner_task_status = ScannerTaskStatus.IN_PROGRESS
    else:
        raise APIException({"detail": "Unknown scanner task action"})

    line.scanner_task_type = task_type
    line.scanner_task_last_operator = operator.staff_name
    line.save(
        update_fields=[
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_last_operator",
            "update_time",
        ]
    )
    return line


@transaction.atomic
def assign_cycle_count_line(
    *,
    openid: str,
    cycle_count_line: CycleCountLine,
    payload: AssignmentPayload,
    recount: bool = False,
) -> CycleCountLine:
    ensure_tenant_match(cycle_count_line, openid, "Cycle count line")
    line = CycleCountLine.objects.select_for_update().select_related("cycle_count", "approval").get(pk=cycle_count_line.pk)
    if line.adjustment_movement_id is not None:
        raise APIException({"detail": "Reconciled count lines cannot be reassigned"})
    if line.cycle_count.status in {CycleCountStatus.CANCELLED, CycleCountStatus.COMPLETED}:
        raise APIException({"detail": "Closed cycle counts cannot be reassigned"})

    assigned_to = payload.assigned_to
    if assigned_to is not None:
        ensure_tenant_match(assigned_to, openid, "Assigned staff")
        if assigned_to.is_lock:
            raise APIException({"detail": "Assigned operator is locked"})

    now = timezone.now()
    if recount:
        approval = getattr(line, "approval", None)
        if line.status != CycleCountLineStatus.REJECTED and (approval is None or approval.status != CountApprovalStatus.REJECTED):
            raise APIException({"detail": "Recount assignment is only available for rejected variance lines"})
        line.recount_assigned_to = assigned_to
        line.recount_assigned_at = now if assigned_to is not None else None
        line.status = CycleCountLineStatus.RECOUNT_ASSIGNED if assigned_to is not None else CycleCountLineStatus.REJECTED
        _reset_scanner_task(line, task_type=ScannerTaskType.RECOUNT if assigned_to is not None else ScannerTaskType.NONE)
        line.save(
            update_fields=[
                "recount_assigned_to",
                "recount_assigned_at",
                "status",
                "scanner_task_type",
                "scanner_task_status",
                "scanner_task_acknowledged_at",
                "scanner_task_started_at",
                "scanner_task_completed_at",
                "scanner_task_last_operator",
                "update_time",
            ]
        )
    else:
        line.assigned_to = assigned_to
        line.assigned_at = now if assigned_to is not None else None
        _reset_scanner_task(line, task_type=ScannerTaskType.COUNT if assigned_to is not None else ScannerTaskType.NONE)
        line.save(
            update_fields=[
                "assigned_to",
                "assigned_at",
                "scanner_task_type",
                "scanner_task_status",
                "scanner_task_acknowledged_at",
                "scanner_task_started_at",
                "scanner_task_completed_at",
                "scanner_task_last_operator",
                "update_time",
            ]
        )
    refresh_cycle_count_status(line.cycle_count)
    return line


@transaction.atomic
def update_cycle_count_line(
    *,
    openid: str,
    operator: Staff,
    cycle_count_line: CycleCountLine,
    payload: CycleCountLineUpdatePayload,
    recount: bool = False,
) -> CycleCountLine:
    ensure_tenant_match(cycle_count_line, openid, "Cycle count line")
    cycle_count_line = (
        CycleCountLine.objects.select_for_update()
        .select_related("cycle_count", "adjustment_reason", "approval", "assigned_to", "recount_assigned_to")
        .get(pk=cycle_count_line.pk)
    )
    if cycle_count_line.adjustment_movement_id is not None:
        raise APIException({"detail": "Reconciled count lines are immutable once an adjustment is posted"})
    if cycle_count_line.status == CycleCountLineStatus.PENDING_APPROVAL:
        raise APIException({"detail": "Pending approvals must be decided before the count line can change"})
    if cycle_count_line.cycle_count.status == CycleCountStatus.CANCELLED:
        raise APIException({"detail": "Cancelled cycle counts cannot be updated"})
    if cycle_count_line.status == CycleCountLineStatus.REJECTED and not recount:
        raise APIException({"detail": "Rejected count lines require a recount assignment before they can be recounted"})
    if recount and cycle_count_line.status not in {CycleCountLineStatus.RECOUNT_ASSIGNED, CycleCountLineStatus.REJECTED}:
        raise APIException({"detail": "Recounts are only available for rejected or reassigned count lines"})
    _ensure_line_operator_access(line=cycle_count_line, operator=operator, recount=recount)

    if payload.adjustment_reason is not None:
        ensure_tenant_match(payload.adjustment_reason, openid, "Adjustment reason")
        cycle_count_line.adjustment_reason = payload.adjustment_reason
    if payload.notes != cycle_count_line.notes:
        cycle_count_line.notes = payload.notes
    if payload.counted_qty is not None:
        cycle_count_line.counted_qty = payload.counted_qty
        cycle_count_line.variance_qty = payload.counted_qty - cycle_count_line.system_qty
        if recount:
            cycle_count_line.recount_counted_qty = payload.counted_qty
            cycle_count_line.recounted_by = operator.staff_name
            cycle_count_line.recounted_at = timezone.now()
            cycle_count_line.status = CycleCountLineStatus.COUNTED
        else:
            cycle_count_line.counted_by = operator.staff_name
            cycle_count_line.counted_at = timezone.now()
            cycle_count_line.status = CycleCountLineStatus.COUNTED
    elif cycle_count_line.counted_qty is not None:
        cycle_count_line.status = _reconcile_line_status(cycle_count_line)
    if recount:
        cycle_count_line.counted_by = cycle_count_line.counted_by or operator.staff_name
        cycle_count_line.counted_at = cycle_count_line.counted_at or timezone.now()
        cycle_count_line.recount_assigned_to = cycle_count_line.recount_assigned_to
        cycle_count_line.recount_assigned_at = cycle_count_line.recount_assigned_at
        cycle_count_line.status = CycleCountLineStatus.COUNTED
    task_type = ScannerTaskType.RECOUNT if recount else ScannerTaskType.COUNT if cycle_count_line.assigned_to_id else ScannerTaskType.NONE
    _complete_scanner_task(cycle_count_line, operator_name=operator.staff_name, task_type=task_type)

    cycle_count_line.save(
        update_fields=[
            "adjustment_reason",
            "notes",
            "counted_qty",
            "variance_qty",
            "counted_by",
            "counted_at",
            "recount_counted_qty",
            "recounted_by",
            "recounted_at",
            "status",
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_completed_at",
            "scanner_task_last_operator",
            "update_time",
        ]
    )
    refresh_cycle_count_status(cycle_count_line.cycle_count)
    return cycle_count_line


@transaction.atomic
def complete_scanner_task(
    *,
    openid: str,
    operator: Staff,
    cycle_count_line: CycleCountLine,
    payload: CycleCountLineUpdatePayload,
) -> CycleCountLine:
    line = transition_scanner_task(
        openid=openid,
        operator=operator,
        cycle_count_line=cycle_count_line,
        action="start",
    )
    recount, _task_type = _resolve_scanner_task(line)
    return update_cycle_count_line(
        openid=openid,
        operator=operator,
        cycle_count_line=line,
        payload=payload,
        recount=recount,
    )


@transaction.atomic
def _apply_line_adjustment(
    *,
    openid: str,
    operator_name: str,
    cycle_count_line: CycleCountLine,
) -> CycleCountLine:
    ensure_tenant_match(cycle_count_line, openid, "Cycle count line")
    if cycle_count_line.adjustment_reason is None:
        raise APIException({"detail": "Variance lines require an adjustment reason before reconciliation"})
    if cycle_count_line.variance_qty == ZERO:
        cycle_count_line.status = CycleCountLineStatus.RECONCILED
        cycle_count_line.save(update_fields=["status", "update_time"])
        return cycle_count_line
    if cycle_count_line.inventory_balance_id is None:
        raise APIException({"detail": "Cycle count line is missing its source inventory balance"})

    balance = (
        InventoryBalance.objects.select_for_update()
        .select_related("warehouse", "location", "goods")
        .get(pk=cycle_count_line.inventory_balance_id)
    )
    ensure_tenant_match(balance, openid, "Inventory balance")
    if balance.on_hand_qty != cycle_count_line.system_qty:
        raise APIException({"detail": "Inventory changed after the cycle count snapshot. Create a new count before adjusting."})

    movement = apply_inventory_adjustment(
        openid=openid,
        operator_name=operator_name,
        inventory_balance=balance,
        variance_qty=cycle_count_line.variance_qty,
        adjustment_reason=cycle_count_line.adjustment_reason,
        reference_code=cycle_count_line.cycle_count.count_number,
        notes=cycle_count_line.notes,
    )
    cycle_count_line.adjustment_movement = movement
    cycle_count_line.status = CycleCountLineStatus.RECONCILED
    cycle_count_line.save(update_fields=["adjustment_movement", "status", "update_time"])
    return cycle_count_line


@transaction.atomic
def submit_cycle_count(*, openid: str, operator_name: str, cycle_count: CycleCount) -> CycleCount:
    ensure_tenant_match(cycle_count, openid, "Cycle count")
    cycle_count = CycleCount.objects.select_for_update().select_related("warehouse").get(pk=cycle_count.pk)
    if cycle_count.status == CycleCountStatus.CANCELLED:
        raise APIException({"detail": "Cancelled cycle counts cannot be submitted"})
    lines = list(
        cycle_count.lines.select_for_update().select_related(
            "inventory_balance",
            "adjustment_reason",
            "approval",
        ).filter(is_delete=False)
    )
    if not lines:
        raise APIException({"detail": "Cycle counts require at least one line"})

    for line in lines:
        if line.status == CycleCountLineStatus.RECOUNT_ASSIGNED:
            raise APIException({"detail": f"Cycle count line {line.line_number} is assigned for recount and cannot be submitted yet"})
        if line.status == CycleCountLineStatus.REJECTED:
            raise APIException({"detail": f"Cycle count line {line.line_number} was rejected and must be recounted before resubmission"})
        if line.counted_qty is None:
            raise APIException({"detail": f"Cycle count line {line.line_number} is missing a counted quantity"})
        if line.variance_qty == ZERO:
            line.status = CycleCountLineStatus.RECONCILED
            line.save(update_fields=["status", "update_time"])
            if hasattr(line, "approval"):
                approval = line.approval
                approval.status = CountApprovalStatus.AUTO_APPROVED
                approval.approved_by = operator_name
                approval.approved_at = timezone.now()
                approval.rejected_by = ""
                approval.rejected_at = None
                approval.notes = "No variance after recount."
                approval.save(update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"])
            continue
        if line.adjustment_reason is None:
            raise APIException({"detail": f"Cycle count line {line.line_number} requires an adjustment reason"})
        ensure_adjustment_reason_usable(
            openid=openid,
            adjustment_reason=line.adjustment_reason,
            variance_qty=line.variance_qty,
        )
        approval_rule = find_adjustment_approval_rule(
            openid=openid,
            warehouse=cycle_count.warehouse,
            adjustment_reason=line.adjustment_reason,
            variance_qty=line.variance_qty,
        )
        requires_approval = line.adjustment_reason.requires_approval or approval_rule is not None
        approval, _ = CountApproval.objects.get_or_create(
            cycle_count_line=line,
            defaults={
                "approval_rule": approval_rule,
                "status": CountApprovalStatus.PENDING,
                "requested_by": operator_name,
                "notes": line.notes,
                "creator": operator_name,
                "openid": openid,
            },
        )
        approval.approval_rule = approval_rule
        approval.requested_by = operator_name
        approval.requested_at = timezone.now()
        approval.notes = line.notes
        approval.rejected_by = ""
        approval.rejected_at = None
        if requires_approval:
            approval.status = CountApprovalStatus.PENDING
            approval.approved_by = ""
            approval.approved_at = None
            approval.save(
                update_fields=[
                    "approval_rule",
                    "status",
                    "requested_by",
                    "requested_at",
                    "approved_by",
                    "approved_at",
                    "rejected_by",
                    "rejected_at",
                    "notes",
                    "update_time",
                ]
            )
            line.status = CycleCountLineStatus.PENDING_APPROVAL
            line.save(update_fields=["status", "update_time"])
            continue
        _apply_line_adjustment(openid=openid, operator_name=operator_name, cycle_count_line=line)
        approval.status = CountApprovalStatus.AUTO_APPROVED
        approval.approved_by = operator_name
        approval.approved_at = timezone.now()
        approval.save(
            update_fields=[
                "approval_rule",
                "status",
                "requested_by",
                "requested_at",
                "approved_by",
                "approved_at",
                "rejected_by",
                "rejected_at",
                "notes",
                "update_time",
            ]
        )

    cycle_count.submitted_by = operator_name
    cycle_count.submitted_at = timezone.now()
    cycle_count.save(update_fields=["submitted_by", "submitted_at", "update_time"])
    refresh_cycle_count_status(cycle_count)
    return cycle_count


@transaction.atomic
def approve_count_approval(
    *,
    openid: str,
    operator: Staff,
    approval: CountApproval,
    payload: ApprovalDecisionPayload,
) -> CountApproval:
    ensure_tenant_match(approval, openid, "Count approval")
    approval = (
        CountApproval.objects.select_for_update()
        .select_related(
            "cycle_count_line",
            "cycle_count_line__cycle_count",
            "cycle_count_line__adjustment_reason",
            "cycle_count_line__inventory_balance",
            "approval_rule",
        )
        .get(pk=approval.pk)
    )
    if approval.status != CountApprovalStatus.PENDING:
        raise APIException({"detail": "Only pending approvals can be approved"})

    required_role = approval.approval_rule.approver_role if approval.approval_rule_id else DEFAULT_APPROVER_ROLE
    if not operator_can_approve_adjustment(operator_role=operator.staff_type, required_role=required_role):
        raise PermissionDenied({"detail": f"Role `{operator.staff_type}` cannot approve this variance. Required role: {required_role}"})

    _apply_line_adjustment(
        openid=openid,
        operator_name=operator.staff_name,
        cycle_count_line=approval.cycle_count_line,
    )
    approval.status = CountApprovalStatus.APPROVED
    approval.approved_by = operator.staff_name
    approval.approved_at = timezone.now()
    approval.rejected_by = ""
    approval.rejected_at = None
    approval.notes = payload.notes or approval.notes
    approval.save(
        update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"]
    )
    refresh_cycle_count_status(approval.cycle_count_line.cycle_count)
    return approval


@transaction.atomic
def reject_count_approval(
    *,
    openid: str,
    operator: Staff,
    approval: CountApproval,
    payload: ApprovalDecisionPayload,
) -> CountApproval:
    ensure_tenant_match(approval, openid, "Count approval")
    approval = CountApproval.objects.select_for_update().select_related(
        "cycle_count_line",
        "cycle_count_line__cycle_count",
        "approval_rule",
    ).get(pk=approval.pk)
    if approval.status != CountApprovalStatus.PENDING:
        raise APIException({"detail": "Only pending approvals can be rejected"})

    required_role = approval.approval_rule.approver_role if approval.approval_rule_id else DEFAULT_APPROVER_ROLE
    if not operator_can_approve_adjustment(operator_role=operator.staff_type, required_role=required_role):
        raise PermissionDenied({"detail": f"Role `{operator.staff_type}` cannot reject this variance. Required role: {required_role}"})

    line = approval.cycle_count_line
    line.status = CycleCountLineStatus.REJECTED
    line.save(update_fields=["status", "update_time"])
    approval.status = CountApprovalStatus.REJECTED
    approval.approved_by = ""
    approval.approved_at = None
    approval.rejected_by = operator.staff_name
    approval.rejected_at = timezone.now()
    approval.notes = payload.notes or approval.notes
    approval.save(
        update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"]
    )
    refresh_cycle_count_status(line.cycle_count)
    return approval


def build_approval_summary(*, openid: str) -> dict[str, object]:
    base_queryset = CountApproval.objects.filter(openid=openid, is_delete=False)
    pending_queryset = base_queryset.filter(status=CountApprovalStatus.PENDING)
    rejected_queryset = base_queryset.filter(status=CountApprovalStatus.REJECTED)
    return {
        "pending_count": pending_queryset.count(),
        "rejected_count": rejected_queryset.count(),
        "pending_by_warehouse": list(
            pending_queryset.values(
                "cycle_count_line__cycle_count__warehouse_id",
                "cycle_count_line__cycle_count__warehouse__warehouse_name",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__cycle_count__warehouse__warehouse_name")
        ),
        "rejected_by_warehouse": list(
            rejected_queryset.values(
                "cycle_count_line__cycle_count__warehouse_id",
                "cycle_count_line__cycle_count__warehouse__warehouse_name",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__cycle_count__warehouse__warehouse_name")
        ),
        "pending_by_reason": list(
            pending_queryset.values("cycle_count_line__adjustment_reason__code")
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__adjustment_reason__code")
        ),
        "rejected_by_reason": list(
            rejected_queryset.values("cycle_count_line__adjustment_reason__code")
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__adjustment_reason__code")
        ),
    }


def _hours_since(*, earlier, now) -> float:
    return round(max((now - earlier).total_seconds(), 0) / 3600, 2)


def _required_role_for_approval(approval: CountApproval) -> str:
    if approval.approval_rule_id:
        return approval.approval_rule.approver_role
    return DEFAULT_APPROVER_ROLE


def _approval_matches_filters(
    approval: CountApproval,
    *,
    warehouse_id: int | None,
    approver_role: str | None,
) -> bool:
    if warehouse_id is not None and approval.cycle_count_line.cycle_count.warehouse_id != warehouse_id:
        return False
    if approver_role and _required_role_for_approval(approval).lower() != approver_role.lower():
        return False
    return True


def build_supervisor_dashboard(
    *,
    openid: str,
    pending_sla_hours: int = 24,
    recount_sla_hours: int = 8,
    limit: int = 10,
    warehouse_id: int | None = None,
    approver_role: str | None = None,
) -> dict[str, object]:
    now = timezone.now()
    pending_approvals = [
        approval
        for approval in (
        CountApproval.objects.select_related(
            "cycle_count_line",
            "cycle_count_line__cycle_count",
            "cycle_count_line__cycle_count__warehouse",
            "cycle_count_line__location",
            "cycle_count_line__goods",
            "approval_rule",
        )
        .filter(openid=openid, is_delete=False, status=CountApprovalStatus.PENDING)
        .order_by("requested_at", "id")
        )
        if _approval_matches_filters(approval, warehouse_id=warehouse_id, approver_role=approver_role)
    ]
    pending_buckets = {
        "lt_4h": 0,
        "gte_4h_lt_8h": 0,
        "gte_8h_lt_24h": 0,
        "gte_24h": 0,
    }
    pending_sla_breach_count = 0
    for approval in pending_approvals:
        age_hours = _hours_since(earlier=approval.requested_at, now=now)
        if age_hours < 4:
            pending_buckets["lt_4h"] += 1
        elif age_hours < 8:
            pending_buckets["gte_4h_lt_8h"] += 1
        elif age_hours < 24:
            pending_buckets["gte_8h_lt_24h"] += 1
        else:
            pending_buckets["gte_24h"] += 1
        if age_hours >= pending_sla_hours:
            pending_sla_breach_count += 1

    pending_oldest_items = [
        {
            "approval_id": approval.id,
            "count_number": approval.cycle_count_line.cycle_count.count_number,
            "warehouse_name": approval.cycle_count_line.cycle_count.warehouse.warehouse_name,
            "location_code": approval.cycle_count_line.location.location_code,
            "goods_code": approval.cycle_count_line.goods.goods_code,
            "variance_qty": str(approval.cycle_count_line.variance_qty),
            "required_role": approval.approval_rule.approver_role if approval.approval_rule_id else DEFAULT_APPROVER_ROLE,
            "age_hours": _hours_since(earlier=approval.requested_at, now=now),
        }
        for approval in pending_approvals[:limit]
    ]

    recount_approvals = [
        approval
        for approval in (
        CountApproval.objects.select_related(
            "cycle_count_line",
            "cycle_count_line__cycle_count",
            "cycle_count_line__cycle_count__warehouse",
            "cycle_count_line__location",
            "cycle_count_line__goods",
            "cycle_count_line__recount_assigned_to",
        )
        .filter(
            openid=openid,
            is_delete=False,
            status=CountApprovalStatus.REJECTED,
            cycle_count_line__status__in=[CycleCountLineStatus.REJECTED, CycleCountLineStatus.RECOUNT_ASSIGNED],
        )
        .order_by("rejected_at", "id")
        )
        if _approval_matches_filters(approval, warehouse_id=warehouse_id, approver_role=approver_role)
    ]
    recount_items = []
    recount_sla_breach_count = 0
    for approval in recount_approvals:
        line = approval.cycle_count_line
        reference_time = line.recount_assigned_at or approval.rejected_at or approval.requested_at
        age_hours = _hours_since(earlier=reference_time, now=now)
        if age_hours >= recount_sla_hours:
            recount_sla_breach_count += 1
            recount_items.append(
                {
                    "approval_id": approval.id,
                    "count_number": line.cycle_count.count_number,
                    "warehouse_name": line.cycle_count.warehouse.warehouse_name,
                    "location_code": line.location.location_code,
                    "goods_code": line.goods.goods_code,
                    "variance_qty": str(line.variance_qty),
                    "line_status": line.status,
                    "recount_assigned_to": line.recount_assigned_to.staff_name if line.recount_assigned_to_id else "",
                    "age_hours": age_hours,
                }
            )

    recount_items.sort(key=lambda item: item["age_hours"], reverse=True)
    return {
        "as_of": now.isoformat(),
        "pending_sla_hours": pending_sla_hours,
        "recount_sla_hours": recount_sla_hours,
        "warehouse_id": warehouse_id,
        "approver_role": approver_role or "",
        "pending_variances": {
            "count": len(pending_approvals),
            "sla_breach_count": pending_sla_breach_count,
            "age_buckets": pending_buckets,
            "oldest_items": pending_oldest_items,
        },
        "recount_breaches": {
            "open_count": len(recount_approvals),
            "sla_breach_count": recount_sla_breach_count,
            "overdue_items": recount_items[:limit],
        },
    }


def build_supervisor_dashboard_export_rows(
    *,
    openid: str,
    pending_sla_hours: int = 24,
    recount_sla_hours: int = 8,
    scope: str = "all",
    warehouse_id: int | None = None,
    approver_role: str | None = None,
) -> list[dict[str, object]]:
    now = timezone.now()
    rows: list[dict[str, object]] = []
    normalized_scope = scope.lower()
    include_pending = normalized_scope in {"all", "pending", "pending_variances"}
    include_recount = normalized_scope in {"all", "recount", "recount_breaches"}
    if not include_pending and not include_recount:
        raise APIException({"detail": "Query parameter `scope` must be one of: all, pending, recount"})

    if include_pending:
        pending_queryset = (
            CountApproval.objects.select_related(
                "cycle_count_line",
                "cycle_count_line__cycle_count",
                "cycle_count_line__cycle_count__warehouse",
                "cycle_count_line__location",
                "cycle_count_line__goods",
                "approval_rule",
            )
            .filter(openid=openid, is_delete=False, status=CountApprovalStatus.PENDING)
            .order_by("requested_at", "id")
        )
        for approval in pending_queryset:
            if not _approval_matches_filters(approval, warehouse_id=warehouse_id, approver_role=approver_role):
                continue
            age_hours = _hours_since(earlier=approval.requested_at, now=now)
            rows.append(
                {
                    "record_type": "PENDING_VARIANCE",
                    "approval_id": approval.id,
                    "count_number": approval.cycle_count_line.cycle_count.count_number,
                    "warehouse_name": approval.cycle_count_line.cycle_count.warehouse.warehouse_name,
                    "location_code": approval.cycle_count_line.location.location_code,
                    "goods_code": approval.cycle_count_line.goods.goods_code,
                    "variance_qty": str(approval.cycle_count_line.variance_qty),
                    "required_role": approval.approval_rule.approver_role if approval.approval_rule_id else DEFAULT_APPROVER_ROLE,
                    "line_status": approval.cycle_count_line.status,
                    "assigned_to": approval.cycle_count_line.assigned_to.staff_name if approval.cycle_count_line.assigned_to_id else "",
                    "requested_at": approval.requested_at.isoformat(),
                    "age_hours": age_hours,
                    "sla_breach": "yes" if age_hours >= pending_sla_hours else "no",
                }
            )

    if include_recount:
        recount_queryset = (
            CountApproval.objects.select_related(
                "cycle_count_line",
                "cycle_count_line__cycle_count",
                "cycle_count_line__cycle_count__warehouse",
                "cycle_count_line__location",
                "cycle_count_line__goods",
                "cycle_count_line__recount_assigned_to",
            )
            .filter(
                openid=openid,
                is_delete=False,
                status=CountApprovalStatus.REJECTED,
                cycle_count_line__status__in=[CycleCountLineStatus.REJECTED, CycleCountLineStatus.RECOUNT_ASSIGNED],
            )
            .order_by("rejected_at", "id")
        )
        for approval in recount_queryset:
            if not _approval_matches_filters(approval, warehouse_id=warehouse_id, approver_role=approver_role):
                continue
            line = approval.cycle_count_line
            reference_time = line.recount_assigned_at or approval.rejected_at or approval.requested_at
            age_hours = _hours_since(earlier=reference_time, now=now)
            if age_hours < recount_sla_hours:
                continue
            rows.append(
                {
                    "record_type": "RECOUNT_BREACH",
                    "approval_id": approval.id,
                    "count_number": line.cycle_count.count_number,
                    "warehouse_name": line.cycle_count.warehouse.warehouse_name,
                    "location_code": line.location.location_code,
                    "goods_code": line.goods.goods_code,
                    "variance_qty": str(line.variance_qty),
                    "required_role": _required_role_for_approval(approval),
                    "line_status": line.status,
                    "assigned_to": line.recount_assigned_to.staff_name if line.recount_assigned_to_id else "",
                    "requested_at": reference_time.isoformat(),
                    "age_hours": age_hours,
                    "sla_breach": "yes",
                }
            )

    rows.sort(key=lambda item: (item["record_type"], -float(item["age_hours"])))
    return rows
