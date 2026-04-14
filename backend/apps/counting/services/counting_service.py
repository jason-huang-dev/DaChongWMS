from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from apps.counting.models import (
    CountApproval,
    CountApprovalStatus,
    CycleCount,
    CycleCountLine,
    CycleCountLineStatus,
    CycleCountStatus,
    ScannerTaskStatus,
    ScannerTaskType,
)
from apps.iam.constants import PermissionCode
from apps.iam.permissions import membership_has_any_permission, membership_has_permission
from apps.inventory.models import AdjustmentDirection, InventoryAdjustmentApprovalRule, InventoryAdjustmentReason, InventoryBalance, InventoryStatus, MovementType
from apps.inventory.services.inventory_service import CreateInventoryMovementInput, record_inventory_movement
from apps.organizations.models import Organization, OrganizationMembership
from apps.warehouse.models import Warehouse

ZERO = Decimal("0.0000")
_UNSET = object()


@dataclass(frozen=True, slots=True)
class CreateCycleCountLineInput:
    inventory_balance: InventoryBalance
    line_number: int | None = None
    assigned_membership: OrganizationMembership | None = None


@dataclass(frozen=True, slots=True)
class CreateCycleCountInput:
    organization: Organization
    warehouse: Warehouse
    count_number: str
    scheduled_date: date | None = None
    is_blind_count: bool = False
    notes: str = ""
    line_items: tuple[CreateCycleCountLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class CycleCountLineUpdateInput:
    counted_qty: Decimal | None
    adjustment_reason: InventoryAdjustmentReason | None = None
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CountApprovalDecisionInput:
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CycleCountAssignmentInput:
    assigned_membership: OrganizationMembership | None


@dataclass(frozen=True, slots=True)
class ScannerLookupInput:
    location: str
    sku: str
    count_number: str = ""
    recount: bool = False


def _validate_membership_assignment(membership: OrganizationMembership | None, organization: Organization) -> None:
    if membership is None:
        return
    if membership.organization_id != organization.id:
        raise ValidationError({"assigned_membership": "Assigned membership must belong to the same organization."})
    if not membership.is_active:
        raise ValidationError({"assigned_membership": "Assigned membership must be active."})


def _current_task_type(line: CycleCountLine) -> str:
    if line.status == CycleCountLineStatus.RECOUNT_ASSIGNED and line.recount_assigned_membership_id:
        return ScannerTaskType.RECOUNT
    if line.status == CycleCountLineStatus.OPEN and line.assigned_membership_id:
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


def _ensure_adjustment_reason_usable(reason: InventoryAdjustmentReason, variance_qty: Decimal) -> None:
    if not reason.is_active:
        raise ValidationError({"adjustment_reason": "Adjustment reason must be active."})
    if variance_qty > ZERO and reason.direction not in {AdjustmentDirection.INCREASE, AdjustmentDirection.BOTH}:
        raise ValidationError({"adjustment_reason": "Adjustment reason does not permit increase adjustments."})
    if variance_qty < ZERO and reason.direction not in {AdjustmentDirection.DECREASE, AdjustmentDirection.BOTH}:
        raise ValidationError({"adjustment_reason": "Adjustment reason does not permit decrease adjustments."})


def _find_adjustment_approval_rule(
    *,
    organization: Organization,
    warehouse: Warehouse,
    adjustment_reason: InventoryAdjustmentReason,
    variance_qty: Decimal,
) -> InventoryAdjustmentApprovalRule | None:
    absolute_variance = abs(variance_qty)
    return (
        InventoryAdjustmentApprovalRule.objects.filter(
            organization=organization,
            adjustment_reason=adjustment_reason,
            is_active=True,
            minimum_variance_qty__lte=absolute_variance,
        )
        .filter(Q(warehouse=warehouse) | Q(warehouse__isnull=True))
        .order_by("-warehouse_id", "-minimum_variance_qty", "id")
        .first()
    )


def _membership_has_role_code(membership: OrganizationMembership, role_code: str) -> bool:
    normalized = role_code.strip().upper()
    if not normalized:
        return False
    return membership.role_assignments.filter(role__code=normalized).exists()


def _approval_role_allowed(membership: OrganizationMembership, required_role: str) -> bool:
    if membership_has_permission(membership, PermissionCode.MANAGE_COUNT_APPROVALS):
        return True
    return _membership_has_role_code(membership, required_role)


def _ensure_line_operator_access(
    *,
    line: CycleCountLine,
    membership: OrganizationMembership,
    recount: bool,
) -> None:
    assignee = line.recount_assigned_membership if recount else line.assigned_membership
    if assignee is None or assignee.id == membership.id:
        return
    if membership_has_any_permission(
        membership,
        (
            PermissionCode.MANAGE_COUNTING,
            PermissionCode.MANAGE_COUNT_APPROVALS,
        ),
    ):
        return
    raise ValidationError({"assigned_membership": "This count line is assigned to a different membership."})


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
    lines = list(cycle_count.lines.all())
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


def list_cycle_counts(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
) -> list[CycleCount]:
    queryset = CycleCount.objects.select_related("warehouse").prefetch_related("lines").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    return list(queryset.order_by("-create_time", "-id"))


def list_cycle_count_lines(
    *,
    organization: Organization,
    cycle_count_id: int | None = None,
    warehouse_id: int | None = None,
    status: str | None = None,
    assigned_membership_id: int | None = None,
) -> list[CycleCountLine]:
    queryset = CycleCountLine.objects.select_related(
        "cycle_count",
        "cycle_count__warehouse",
        "inventory_balance",
        "location",
        "product",
        "adjustment_reason",
        "adjustment_movement",
        "assigned_membership",
        "recount_assigned_membership",
        "approval",
        "approval__approval_rule",
    ).filter(organization=organization)
    if cycle_count_id is not None:
        queryset = queryset.filter(cycle_count_id=cycle_count_id)
    if warehouse_id is not None:
        queryset = queryset.filter(cycle_count__warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    if assigned_membership_id is not None:
        queryset = queryset.filter(
            Q(assigned_membership_id=assigned_membership_id) | Q(recount_assigned_membership_id=assigned_membership_id)
        )
    return list(queryset.order_by("cycle_count_id", "line_number", "id"))


def list_count_approvals(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
) -> list[CountApproval]:
    queryset = CountApproval.objects.select_related(
        "cycle_count_line",
        "cycle_count_line__cycle_count",
        "cycle_count_line__cycle_count__warehouse",
        "cycle_count_line__adjustment_reason",
        "approval_rule",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(cycle_count_line__cycle_count__warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    return list(queryset.order_by("-requested_at", "-id"))


@transaction.atomic
def create_cycle_count(payload: CreateCycleCountInput) -> CycleCount:
    if not payload.line_items:
        raise ValidationError({"line_items": "Cycle counts require at least one inventory balance."})
    if payload.warehouse.organization_id != payload.organization.id:
        raise ValidationError({"warehouse": "Warehouse must belong to the same organization as the cycle count."})

    cycle_count = CycleCount.objects.create(
        organization=payload.organization,
        warehouse=payload.warehouse,
        count_number=payload.count_number,
        scheduled_date=payload.scheduled_date,
        is_blind_count=payload.is_blind_count,
        notes=payload.notes,
    )

    used_balance_ids: set[int] = set()
    for index, item in enumerate(payload.line_items, start=1):
        if item.inventory_balance.organization_id != payload.organization.id:
            raise ValidationError({"line_items": "Inventory balance must belong to the same organization."})
        if item.inventory_balance.warehouse_id != payload.warehouse.id:
            raise ValidationError({"line_items": "Inventory balance must belong to the selected warehouse."})
        if item.inventory_balance.id in used_balance_ids:
            raise ValidationError({"line_items": "Cycle counts cannot include the same inventory balance more than once."})
        used_balance_ids.add(item.inventory_balance.id)
        _validate_membership_assignment(item.assigned_membership, payload.organization)
        line_number = item.line_number or index
        CycleCountLine.objects.create(
            organization=payload.organization,
            cycle_count=cycle_count,
            line_number=line_number,
            inventory_balance=item.inventory_balance,
            location=item.inventory_balance.location,
            product=item.inventory_balance.product,
            stock_status=item.inventory_balance.stock_status,
            lot_number=item.inventory_balance.lot_number,
            serial_number=item.inventory_balance.serial_number,
            system_qty=item.inventory_balance.on_hand_qty,
            assigned_membership=item.assigned_membership,
            assigned_at=timezone.now() if item.assigned_membership is not None else None,
            scanner_task_type=ScannerTaskType.COUNT if item.assigned_membership is not None else ScannerTaskType.NONE,
            scanner_task_status=ScannerTaskStatus.PENDING if item.assigned_membership is not None else ScannerTaskStatus.UNASSIGNED,
        )
    return cycle_count


def _assigned_line_queryset(*, membership: OrganizationMembership, recount: bool):
    queryset = CycleCountLine.objects.select_related(
        "cycle_count",
        "inventory_balance",
        "location",
        "product",
        "adjustment_reason",
        "adjustment_movement",
        "assigned_membership",
        "recount_assigned_membership",
        "approval",
        "approval__approval_rule",
    ).filter(
        organization=membership.organization,
    )
    if recount:
        return queryset.filter(
            recount_assigned_membership=membership,
            status=CycleCountLineStatus.RECOUNT_ASSIGNED,
        )
    return queryset.filter(
        assigned_membership=membership,
        status__in=[CycleCountLineStatus.OPEN, CycleCountLineStatus.COUNTED],
    )


def find_cycle_count_line_by_scan(
    *,
    membership: OrganizationMembership,
    payload: ScannerLookupInput,
) -> CycleCountLine:
    queryset = _assigned_line_queryset(membership=membership, recount=payload.recount).filter(
        Q(location__barcode=payload.location) | Q(location__code=payload.location),
        Q(product__barcode=payload.sku) | Q(product__sku=payload.sku),
    )
    if payload.count_number:
        queryset = queryset.filter(cycle_count__count_number=payload.count_number.strip().upper())
    matches = list(queryset.order_by("cycle_count__scheduled_date", "cycle_count_id", "line_number")[:2])
    if not matches:
        raise ValidationError({"detail": "No assigned count line matches the scanned location and SKU."})
    if len(matches) > 1:
        raise ValidationError({"detail": "Scanned location and SKU match multiple assigned count lines. Provide count_number to disambiguate."})
    return matches[0]


def get_next_assigned_cycle_count_line(
    *,
    membership: OrganizationMembership,
) -> tuple[CycleCountLine | None, str | None]:
    recount_candidates = list(_assigned_line_queryset(membership=membership, recount=True))
    recount_candidates = [
        line for line in recount_candidates if _effective_scanner_task_status(line) != ScannerTaskStatus.COMPLETED
    ]
    recount_line = min(recount_candidates, key=_task_sort_key) if recount_candidates else None
    if recount_line is not None:
        return recount_line, ScannerTaskType.RECOUNT

    count_candidates = list(_assigned_line_queryset(membership=membership, recount=False).filter(status=CycleCountLineStatus.OPEN))
    count_candidates = [
        line for line in count_candidates if _effective_scanner_task_status(line) != ScannerTaskStatus.COMPLETED
    ]
    count_line = min(count_candidates, key=_task_sort_key) if count_candidates else None
    if count_line is not None:
        return count_line, ScannerTaskType.COUNT
    return None, None


def _resolve_scanner_task(line: CycleCountLine) -> tuple[bool, str]:
    task_type = _current_task_type(line)
    if task_type == ScannerTaskType.RECOUNT:
        return True, task_type
    if task_type == ScannerTaskType.COUNT:
        return False, task_type
    raise ValidationError({"detail": "This count line does not have an active handheld task."})


@transaction.atomic
def transition_scanner_task(
    *,
    membership: OrganizationMembership,
    operator_name: str,
    cycle_count_line: CycleCountLine,
    action: str,
) -> CycleCountLine:
    line = CycleCountLine.objects.select_for_update(of=("self",)).select_related(
        "cycle_count",
        "assigned_membership",
        "recount_assigned_membership",
    ).get(pk=cycle_count_line.pk)
    recount, task_type = _resolve_scanner_task(line)
    _ensure_line_operator_access(line=line, membership=membership, recount=recount)
    effective_status = _effective_scanner_task_status(line)
    if effective_status == ScannerTaskStatus.COMPLETED:
        raise ValidationError({"detail": "Completed handheld tasks cannot transition again."})

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
        raise ValidationError({"detail": "Unknown scanner task action."})

    line.scanner_task_type = task_type
    line.scanner_task_last_operator = operator_name.strip() or "system"
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
    cycle_count_line: CycleCountLine,
    payload: CycleCountAssignmentInput,
    recount: bool = False,
) -> CycleCountLine:
    line = CycleCountLine.objects.select_for_update(of=("self",)).select_related("cycle_count", "approval").get(
        pk=cycle_count_line.pk
    )
    if line.adjustment_movement_id is not None:
        raise ValidationError({"detail": "Reconciled count lines cannot be reassigned."})
    if line.cycle_count.status in {CycleCountStatus.CANCELLED, CycleCountStatus.COMPLETED}:
        raise ValidationError({"detail": "Closed cycle counts cannot be reassigned."})

    _validate_membership_assignment(payload.assigned_membership, line.organization)
    now = timezone.now()
    if recount:
        approval = getattr(line, "approval", None)
        if line.status != CycleCountLineStatus.REJECTED and (
            approval is None or approval.status != CountApprovalStatus.REJECTED
        ):
            raise ValidationError({"detail": "Recount assignment is only available for rejected variance lines."})
        line.recount_assigned_membership = payload.assigned_membership
        line.recount_assigned_at = now if payload.assigned_membership is not None else None
        line.status = (
            CycleCountLineStatus.RECOUNT_ASSIGNED
            if payload.assigned_membership is not None
            else CycleCountLineStatus.REJECTED
        )
        _reset_scanner_task(
            line,
            task_type=ScannerTaskType.RECOUNT if payload.assigned_membership is not None else ScannerTaskType.NONE,
        )
        line.save(
            update_fields=[
                "recount_assigned_membership",
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
        line.assigned_membership = payload.assigned_membership
        line.assigned_at = now if payload.assigned_membership is not None else None
        _reset_scanner_task(
            line,
            task_type=ScannerTaskType.COUNT if payload.assigned_membership is not None else ScannerTaskType.NONE,
        )
        line.save(
            update_fields=[
                "assigned_membership",
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
    membership: OrganizationMembership,
    operator_name: str,
    cycle_count_line: CycleCountLine,
    payload: CycleCountLineUpdateInput,
    recount: bool = False,
) -> CycleCountLine:
    line = CycleCountLine.objects.select_for_update(of=("self",)).select_related(
        "cycle_count",
        "adjustment_reason",
        "approval",
        "assigned_membership",
        "recount_assigned_membership",
    ).get(pk=cycle_count_line.pk)
    if line.adjustment_movement_id is not None:
        raise ValidationError({"detail": "Reconciled count lines are immutable once an adjustment is posted."})
    if line.status == CycleCountLineStatus.PENDING_APPROVAL:
        raise ValidationError({"detail": "Pending approvals must be decided before the count line can change."})
    if line.cycle_count.status == CycleCountStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled cycle counts cannot be updated."})
    if line.status == CycleCountLineStatus.REJECTED and not recount:
        raise ValidationError({"detail": "Rejected count lines require a recount assignment before they can be recounted."})
    if recount and line.status not in {CycleCountLineStatus.RECOUNT_ASSIGNED, CycleCountLineStatus.REJECTED}:
        raise ValidationError({"detail": "Recounts are only available for rejected or reassigned count lines."})
    _ensure_line_operator_access(line=line, membership=membership, recount=recount)

    if payload.adjustment_reason is not None:
        if payload.adjustment_reason.organization_id != line.organization_id:
            raise ValidationError({"adjustment_reason": "Adjustment reason must belong to the same organization."})
        line.adjustment_reason = payload.adjustment_reason
    line.notes = payload.notes
    if payload.counted_qty is not None:
        line.counted_qty = payload.counted_qty
        line.variance_qty = payload.counted_qty - line.system_qty
        if recount:
            line.recount_counted_qty = payload.counted_qty
            line.recounted_by = operator_name.strip() or "system"
            line.recounted_at = timezone.now()
            line.status = CycleCountLineStatus.COUNTED
        else:
            line.counted_by = operator_name.strip() or "system"
            line.counted_at = timezone.now()
            line.status = CycleCountLineStatus.COUNTED
    elif line.counted_qty is not None:
        line.status = _reconcile_line_status(line)

    if recount:
        line.counted_by = line.counted_by or operator_name.strip() or "system"
        line.counted_at = line.counted_at or timezone.now()
        line.status = CycleCountLineStatus.COUNTED

    task_type = ScannerTaskType.RECOUNT if recount else ScannerTaskType.COUNT if line.assigned_membership_id else ScannerTaskType.NONE
    _complete_scanner_task(line, operator_name=operator_name.strip() or "system", task_type=task_type)
    line.save(
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
    refresh_cycle_count_status(line.cycle_count)
    return line


@transaction.atomic
def complete_scanner_task(
    *,
    membership: OrganizationMembership,
    operator_name: str,
    cycle_count_line: CycleCountLine,
    payload: CycleCountLineUpdateInput,
) -> CycleCountLine:
    line = transition_scanner_task(
        membership=membership,
        operator_name=operator_name,
        cycle_count_line=cycle_count_line,
        action="start",
    )
    recount, _task_type = _resolve_scanner_task(line)
    return update_cycle_count_line(
        membership=membership,
        operator_name=operator_name,
        cycle_count_line=line,
        payload=payload,
        recount=recount,
    )


@transaction.atomic
def _apply_line_adjustment(
    *,
    operator_name: str,
    cycle_count_line: CycleCountLine,
) -> CycleCountLine:
    if cycle_count_line.adjustment_reason is None:
        raise ValidationError({"detail": "Variance lines require an adjustment reason before reconciliation."})
    if cycle_count_line.variance_qty == ZERO:
        cycle_count_line.status = CycleCountLineStatus.RECONCILED
        cycle_count_line.save(update_fields=["status", "update_time"])
        return cycle_count_line
    if cycle_count_line.inventory_balance_id is None:
        raise ValidationError({"detail": "Cycle count line is missing its source inventory balance."})

    balance = InventoryBalance.objects.select_for_update(of=("self",)).select_related(
        "warehouse",
        "location",
        "product",
    ).get(pk=cycle_count_line.inventory_balance_id)
    if balance.on_hand_qty != cycle_count_line.system_qty:
        raise ValidationError({"detail": "Inventory changed after the cycle count snapshot. Create a new count before adjusting."})

    movement_type = MovementType.ADJUSTMENT_IN if cycle_count_line.variance_qty > ZERO else MovementType.ADJUSTMENT_OUT
    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=cycle_count_line.organization,
            warehouse=balance.warehouse,
            product=balance.product,
            movement_type=movement_type,
            quantity=abs(cycle_count_line.variance_qty),
            performed_by=operator_name.strip() or "system",
            from_location=balance.location if movement_type == MovementType.ADJUSTMENT_OUT else None,
            to_location=balance.location if movement_type == MovementType.ADJUSTMENT_IN else None,
            stock_status=balance.stock_status,
            lot_number=balance.lot_number,
            serial_number=balance.serial_number,
            unit_cost=balance.unit_cost,
            currency=balance.currency,
            reference_code=cycle_count_line.cycle_count.count_number,
            reason=cycle_count_line.adjustment_reason.code,
        )
    )
    cycle_count_line.adjustment_movement = movement
    cycle_count_line.status = CycleCountLineStatus.RECONCILED
    cycle_count_line.save(update_fields=["adjustment_movement", "status", "update_time"])
    return cycle_count_line


@transaction.atomic
def submit_cycle_count(
    *,
    cycle_count: CycleCount,
    operator_name: str,
) -> CycleCount:
    cycle_count = CycleCount.objects.select_for_update(of=("self",)).select_related("warehouse").get(pk=cycle_count.pk)
    if cycle_count.status == CycleCountStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled cycle counts cannot be submitted."})
    lines = list(
        cycle_count.lines.select_for_update(of=("self",)).select_related(
            "inventory_balance",
            "adjustment_reason",
            "approval",
        )
    )
    if not lines:
        raise ValidationError({"detail": "Cycle counts require at least one line."})

    for line in lines:
        if line.status == CycleCountLineStatus.RECOUNT_ASSIGNED:
            raise ValidationError({"detail": f"Cycle count line {line.line_number} is assigned for recount and cannot be submitted yet."})
        if line.status == CycleCountLineStatus.REJECTED:
            raise ValidationError({"detail": f"Cycle count line {line.line_number} was rejected and must be recounted before resubmission."})
        if line.counted_qty is None:
            raise ValidationError({"detail": f"Cycle count line {line.line_number} is missing a counted quantity."})
        if line.variance_qty == ZERO:
            line.status = CycleCountLineStatus.RECONCILED
            line.save(update_fields=["status", "update_time"])
            if hasattr(line, "approval"):
                approval = line.approval
                approval.status = CountApprovalStatus.AUTO_APPROVED
                approval.approved_by = operator_name.strip() or "system"
                approval.approved_at = timezone.now()
                approval.rejected_by = ""
                approval.rejected_at = None
                approval.notes = "No variance after recount."
                approval.save(update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"])
            continue
        if line.adjustment_reason is None:
            raise ValidationError({"detail": f"Cycle count line {line.line_number} requires an adjustment reason."})
        _ensure_adjustment_reason_usable(line.adjustment_reason, line.variance_qty)
        approval_rule = _find_adjustment_approval_rule(
            organization=cycle_count.organization,
            warehouse=cycle_count.warehouse,
            adjustment_reason=line.adjustment_reason,
            variance_qty=line.variance_qty,
        )
        requires_approval = line.adjustment_reason.requires_approval or approval_rule is not None
        approval, _ = CountApproval.objects.get_or_create(
            organization=cycle_count.organization,
            cycle_count_line=line,
            defaults={
                "approval_rule": approval_rule,
                "status": CountApprovalStatus.PENDING,
                "requested_by": operator_name.strip() or "system",
                "requested_at": timezone.now(),
                "notes": line.notes,
            },
        )
        approval.approval_rule = approval_rule
        approval.requested_by = operator_name.strip() or "system"
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
        _apply_line_adjustment(operator_name=operator_name, cycle_count_line=line)
        approval.status = CountApprovalStatus.AUTO_APPROVED
        approval.approved_by = operator_name.strip() or "system"
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

    cycle_count.submitted_by = operator_name.strip() or "system"
    cycle_count.submitted_at = timezone.now()
    cycle_count.save(update_fields=["submitted_by", "submitted_at", "update_time"])
    refresh_cycle_count_status(cycle_count)
    return cycle_count


@transaction.atomic
def approve_count_approval(
    *,
    membership: OrganizationMembership,
    operator_name: str,
    approval: CountApproval,
    payload: CountApprovalDecisionInput,
) -> CountApproval:
    approval = CountApproval.objects.select_for_update(of=("self",)).select_related(
        "cycle_count_line",
        "cycle_count_line__cycle_count",
        "cycle_count_line__adjustment_reason",
        "cycle_count_line__inventory_balance",
        "approval_rule",
    ).get(pk=approval.pk)
    if approval.status != CountApprovalStatus.PENDING:
        raise ValidationError({"detail": "Only pending approvals can be approved."})

    required_role = approval.approval_rule.approver_role if approval.approval_rule_id else "MANAGER"
    if not _approval_role_allowed(membership, required_role):
        raise ValidationError({"detail": f"Membership cannot approve this variance. Required role: {required_role}."})

    _apply_line_adjustment(operator_name=operator_name, cycle_count_line=approval.cycle_count_line)
    approval.status = CountApprovalStatus.APPROVED
    approval.approved_by = operator_name.strip() or "system"
    approval.approved_at = timezone.now()
    approval.rejected_by = ""
    approval.rejected_at = None
    approval.notes = payload.notes or approval.notes
    approval.save(update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"])
    refresh_cycle_count_status(approval.cycle_count_line.cycle_count)
    return approval


@transaction.atomic
def reject_count_approval(
    *,
    membership: OrganizationMembership,
    operator_name: str,
    approval: CountApproval,
    payload: CountApprovalDecisionInput,
) -> CountApproval:
    approval = CountApproval.objects.select_for_update(of=("self",)).select_related(
        "cycle_count_line",
        "cycle_count_line__cycle_count",
        "approval_rule",
    ).get(pk=approval.pk)
    if approval.status != CountApprovalStatus.PENDING:
        raise ValidationError({"detail": "Only pending approvals can be rejected."})

    required_role = approval.approval_rule.approver_role if approval.approval_rule_id else "MANAGER"
    if not _approval_role_allowed(membership, required_role):
        raise ValidationError({"detail": f"Membership cannot reject this variance. Required role: {required_role}."})

    line = approval.cycle_count_line
    line.status = CycleCountLineStatus.REJECTED
    line.save(update_fields=["status", "update_time"])
    approval.status = CountApprovalStatus.REJECTED
    approval.approved_by = ""
    approval.approved_at = None
    approval.rejected_by = operator_name.strip() or "system"
    approval.rejected_at = timezone.now()
    approval.notes = payload.notes or approval.notes
    approval.save(update_fields=["status", "approved_by", "approved_at", "rejected_by", "rejected_at", "notes", "update_time"])
    refresh_cycle_count_status(line.cycle_count)
    return approval


def build_approval_summary(*, organization: Organization, warehouse_id: int | None = None) -> dict[str, object]:
    base_queryset = CountApproval.objects.filter(organization=organization)
    if warehouse_id is not None:
        base_queryset = base_queryset.filter(cycle_count_line__cycle_count__warehouse_id=warehouse_id)
    pending_queryset = base_queryset.filter(status=CountApprovalStatus.PENDING)
    rejected_queryset = base_queryset.filter(status=CountApprovalStatus.REJECTED)
    return {
        "pending_count": pending_queryset.count(),
        "rejected_count": rejected_queryset.count(),
        "pending_by_warehouse": list(
            pending_queryset.values(
                "cycle_count_line__cycle_count__warehouse_id",
                "cycle_count_line__cycle_count__warehouse__name",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__cycle_count__warehouse__name")
        ),
        "rejected_by_warehouse": list(
            rejected_queryset.values(
                "cycle_count_line__cycle_count__warehouse_id",
                "cycle_count_line__cycle_count__warehouse__name",
            )
            .annotate(count=Count("id"))
            .order_by("-count", "cycle_count_line__cycle_count__warehouse__name")
        ),
    }
