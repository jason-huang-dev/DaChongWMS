"""Domain services for transfer and replenishment workflows."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.models import InventoryBalance, MovementType
from inventory.services import ensure_location_usable, ensure_tenant_match, record_inventory_movement
from locations.models import ZoneUsage
from staff.models import ListModel as Staff
from warehouse.models import Warehouse

from .models import (
    ReplenishmentRule,
    ReplenishmentTask,
    ReplenishmentTaskStatus,
    TransferLine,
    TransferLineStatus,
    TransferOrder,
    TransferOrderStatus,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class TransferLinePayload:
    line_number: int
    goods: object
    from_location: object
    to_location: object
    requested_qty: Decimal
    stock_status: str
    lot_number: str = ""
    serial_number: str = ""
    notes: str = ""


@dataclass(frozen=True)
class TransferLineUpdatePayload:
    assigned_to: Staff | None
    to_location: object
    status: str
    notes: str


@dataclass(frozen=True)
class ReplenishmentTaskUpdatePayload:
    assigned_to: Staff | None
    to_location: object
    status: str
    notes: str


@dataclass(frozen=True)
class ReplenishmentGeneratePayload:
    assigned_to: Staff | None = None


def _refresh_transfer_order_status(transfer_order: TransferOrder) -> TransferOrder:
    lines = list(transfer_order.lines.filter(is_delete=False))
    if not lines:
        transfer_order.status = TransferOrderStatus.CANCELLED if transfer_order.status == TransferOrderStatus.CANCELLED else TransferOrderStatus.OPEN
    elif all(line.status == TransferLineStatus.CANCELLED for line in lines):
        transfer_order.status = TransferOrderStatus.CANCELLED
    elif all(line.status == TransferLineStatus.COMPLETED for line in lines):
        transfer_order.status = TransferOrderStatus.COMPLETED
    elif any(line.status == TransferLineStatus.COMPLETED for line in lines):
        transfer_order.status = TransferOrderStatus.IN_PROGRESS
    else:
        transfer_order.status = TransferOrderStatus.OPEN
    transfer_order.save(update_fields=["status", "update_time"])
    return transfer_order


def _validate_transfer_locations(*, warehouse: Warehouse, from_location, to_location, openid: str) -> None:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(from_location, openid, "Source location")
    ensure_tenant_match(to_location, openid, "Destination location")
    if from_location.warehouse_id != warehouse.id:
        raise ValidationError({"detail": "Source location must belong to the selected warehouse"})
    if to_location.warehouse_id != warehouse.id:
        raise ValidationError({"detail": "Destination location must belong to the selected warehouse"})
    if from_location.pk == to_location.pk:
        raise ValidationError({"detail": "Source and destination locations must be different"})


@transaction.atomic
def create_transfer_order(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    transfer_number: str,
    requested_date,
    reference_code: str,
    notes: str,
    line_items: list[TransferLinePayload],
) -> TransferOrder:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    if not line_items:
        raise ValidationError({"detail": "Transfer orders require at least one line item"})

    transfer_order = TransferOrder.objects.create(
        warehouse=warehouse,
        transfer_number=transfer_number,
        requested_date=requested_date,
        reference_code=reference_code,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    seen_line_numbers: set[int] = set()
    for payload in line_items:
        if payload.line_number in seen_line_numbers:
            raise ValidationError({"detail": "Transfer order line numbers must be unique"})
        seen_line_numbers.add(payload.line_number)
        ensure_tenant_match(payload.goods, openid, "Goods")
        _validate_transfer_locations(
            warehouse=warehouse,
            from_location=payload.from_location,
            to_location=payload.to_location,
            openid=openid,
        )
        TransferLine.objects.create(
            transfer_order=transfer_order,
            line_number=payload.line_number,
            goods=payload.goods,
            from_location=payload.from_location,
            to_location=payload.to_location,
            requested_qty=payload.requested_qty,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number,
            serial_number=payload.serial_number,
            notes=payload.notes,
            creator=operator_name,
            openid=openid,
        )
    return transfer_order


@transaction.atomic
def update_transfer_order(
    *,
    openid: str,
    transfer_order: TransferOrder,
    requested_date,
    reference_code: str,
    notes: str,
    status: str,
) -> TransferOrder:
    ensure_tenant_match(transfer_order, openid, "Transfer order")
    transfer_order = TransferOrder.objects.select_for_update().get(pk=transfer_order.pk)
    if transfer_order.status == TransferOrderStatus.COMPLETED:
        raise ValidationError({"detail": "Completed transfer orders cannot be updated"})
    if status == TransferOrderStatus.CANCELLED and transfer_order.status == TransferOrderStatus.IN_PROGRESS:
        raise ValidationError({"detail": "In-progress transfer orders cannot be cancelled"})

    transfer_order.requested_date = requested_date
    transfer_order.reference_code = reference_code
    transfer_order.notes = notes
    if status == TransferOrderStatus.CANCELLED:
        transfer_order.status = TransferOrderStatus.CANCELLED
        transfer_order.lines.filter(is_delete=False, status=TransferLineStatus.OPEN).update(
            status=TransferLineStatus.CANCELLED,
            update_time=timezone.now(),
        )
    transfer_order.save(update_fields=["requested_date", "reference_code", "notes", "status", "update_time"])
    return _refresh_transfer_order_status(transfer_order)


@transaction.atomic
def archive_transfer_order(*, openid: str, transfer_order: TransferOrder) -> TransferOrder:
    ensure_tenant_match(transfer_order, openid, "Transfer order")
    transfer_order = TransferOrder.objects.select_for_update().get(pk=transfer_order.pk)
    if transfer_order.lines.filter(is_delete=False, status=TransferLineStatus.COMPLETED).exists():
        raise ValidationError({"detail": "Completed transfer orders cannot be archived"})
    transfer_order.lines.filter(is_delete=False).update(is_delete=True, update_time=timezone.now())
    transfer_order.is_delete = True
    transfer_order.save(update_fields=["is_delete", "update_time"])
    return transfer_order


@transaction.atomic
def update_transfer_line(
    *,
    openid: str,
    transfer_line: TransferLine,
    payload: TransferLineUpdatePayload,
) -> TransferLine:
    ensure_tenant_match(transfer_line, openid, "Transfer line")
    line = TransferLine.objects.select_for_update().select_related("transfer_order").get(pk=transfer_line.pk)
    if line.status == TransferLineStatus.COMPLETED:
        raise ValidationError({"detail": "Completed transfer lines cannot be updated"})
    if line.transfer_order.status in {TransferOrderStatus.CANCELLED, TransferOrderStatus.COMPLETED}:
        raise ValidationError({"detail": "Closed transfer orders cannot be updated"})
    if payload.assigned_to is not None:
        ensure_tenant_match(payload.assigned_to, openid, "Assigned staff")
        if payload.assigned_to.is_lock:
            raise ValidationError({"detail": "Assigned operator is locked"})
    if payload.to_location is not None:
        _validate_transfer_locations(
            warehouse=line.transfer_order.warehouse,
            from_location=line.from_location,
            to_location=payload.to_location,
            openid=openid,
        )
        line.to_location = payload.to_location
    line.assigned_to = payload.assigned_to
    line.notes = payload.notes
    if payload.status == TransferLineStatus.CANCELLED:
        line.status = TransferLineStatus.CANCELLED
    line.save(update_fields=["assigned_to", "to_location", "notes", "status", "update_time"])
    _refresh_transfer_order_status(line.transfer_order)
    return line


@transaction.atomic
def complete_transfer_line(
    *,
    openid: str,
    operator_name: str,
    transfer_line: TransferLine,
    to_location=None,
) -> TransferLine:
    ensure_tenant_match(transfer_line, openid, "Transfer line")
    line = (
        TransferLine.objects.select_for_update()
        .select_related("transfer_order", "transfer_order__warehouse", "goods", "from_location", "to_location")
        .get(pk=transfer_line.pk)
    )
    if line.status == TransferLineStatus.COMPLETED:
        raise ValidationError({"detail": "Transfer line is already completed"})
    if line.status == TransferLineStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled transfer lines cannot be completed"})
    if line.transfer_order.status == TransferOrderStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled transfer orders cannot be completed"})
    destination = to_location or line.to_location
    _validate_transfer_locations(
        warehouse=line.transfer_order.warehouse,
        from_location=line.from_location,
        to_location=destination,
        openid=openid,
    )
    source_balance = InventoryBalance.objects.select_for_update().filter(
        openid=openid,
        is_delete=False,
        warehouse=line.transfer_order.warehouse,
        location=line.from_location,
        goods=line.goods,
        stock_status=line.stock_status,
        lot_number=line.lot_number,
        serial_number=line.serial_number,
    ).first()
    if source_balance is None:
        raise ValidationError({"detail": "No inventory balance exists for the requested source location"})
    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=line.transfer_order.warehouse,
        goods=line.goods,
        movement_type=MovementType.TRANSFER,
        quantity=line.requested_qty,
        stock_status=line.stock_status,
        lot_number=line.lot_number,
        serial_number=line.serial_number,
        unit_cost=source_balance.unit_cost,
        from_location=line.from_location,
        to_location=destination,
        reference_code=line.transfer_order.transfer_number,
        reason=(line.notes or line.transfer_order.notes)[:255],
    )
    line.to_location = destination
    line.moved_qty = line.requested_qty
    line.status = TransferLineStatus.COMPLETED
    line.completed_by = operator_name
    line.completed_at = timezone.now()
    line.inventory_movement = movement
    line.save(
        update_fields=[
            "to_location",
            "moved_qty",
            "status",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "update_time",
        ]
    )
    _refresh_transfer_order_status(line.transfer_order)
    return line


@transaction.atomic
def create_replenishment_rule(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    goods,
    source_location,
    target_location,
    minimum_qty: Decimal,
    target_qty: Decimal,
    stock_status: str,
    priority: int,
    is_active: bool,
    notes: str,
) -> ReplenishmentRule:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(goods, openid, "Goods")
    _validate_transfer_locations(
        warehouse=warehouse,
        from_location=source_location,
        to_location=target_location,
        openid=openid,
    )
    if target_qty <= minimum_qty:
        raise ValidationError({"detail": "Target qty must be greater than minimum qty"})
    return ReplenishmentRule.objects.create(
        warehouse=warehouse,
        goods=goods,
        source_location=source_location,
        target_location=target_location,
        minimum_qty=minimum_qty,
        target_qty=target_qty,
        stock_status=stock_status,
        priority=priority,
        is_active=is_active,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def update_replenishment_rule(
    *,
    openid: str,
    replenishment_rule: ReplenishmentRule,
    warehouse: Warehouse,
    goods,
    source_location,
    target_location,
    minimum_qty: Decimal,
    target_qty: Decimal,
    stock_status: str,
    priority: int,
    is_active: bool,
    notes: str,
) -> ReplenishmentRule:
    ensure_tenant_match(replenishment_rule, openid, "Replenishment rule")
    rule = ReplenishmentRule.objects.select_for_update().get(pk=replenishment_rule.pk)
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(goods, openid, "Goods")
    _validate_transfer_locations(
        warehouse=warehouse,
        from_location=source_location,
        to_location=target_location,
        openid=openid,
    )
    if target_qty <= minimum_qty:
        raise ValidationError({"detail": "Target qty must be greater than minimum qty"})
    rule.warehouse = warehouse
    rule.goods = goods
    rule.source_location = source_location
    rule.target_location = target_location
    rule.minimum_qty = minimum_qty
    rule.target_qty = target_qty
    rule.stock_status = stock_status
    rule.priority = priority
    rule.is_active = is_active
    rule.notes = notes
    rule.save(
        update_fields=[
            "warehouse",
            "goods",
            "source_location",
            "target_location",
            "minimum_qty",
            "target_qty",
            "stock_status",
            "priority",
            "is_active",
            "notes",
            "update_time",
        ]
    )
    return rule


@transaction.atomic
def archive_replenishment_rule(*, openid: str, replenishment_rule: ReplenishmentRule) -> ReplenishmentRule:
    ensure_tenant_match(replenishment_rule, openid, "Replenishment rule")
    rule = ReplenishmentRule.objects.select_for_update().get(pk=replenishment_rule.pk)
    if rule.tasks.filter(is_delete=False, status__in=[ReplenishmentTaskStatus.OPEN, ReplenishmentTaskStatus.ASSIGNED]).exists():
        raise ValidationError({"detail": "Rules with open replenishment tasks cannot be archived"})
    rule.is_delete = True
    rule.save(update_fields=["is_delete", "update_time"])
    return rule


@transaction.atomic
def generate_replenishment_task(
    *,
    openid: str,
    operator_name: str,
    replenishment_rule: ReplenishmentRule,
    payload: ReplenishmentGeneratePayload,
) -> ReplenishmentTask:
    ensure_tenant_match(replenishment_rule, openid, "Replenishment rule")
    rule = (
        ReplenishmentRule.objects.select_for_update()
        .select_related("warehouse", "goods", "source_location", "target_location")
        .get(pk=replenishment_rule.pk)
    )
    if not rule.is_active:
        raise ValidationError({"detail": "Inactive replenishment rules cannot generate tasks"})
    if rule.tasks.filter(is_delete=False, status__in=[ReplenishmentTaskStatus.OPEN, ReplenishmentTaskStatus.ASSIGNED]).exists():
        raise ValidationError({"detail": "This replenishment rule already has an open task"})

    target_balances = list(
        InventoryBalance.objects.filter(
            openid=openid,
            is_delete=False,
            warehouse=rule.warehouse,
            location=rule.target_location,
            goods=rule.goods,
            stock_status=rule.stock_status,
        )
    )
    target_available = sum((balance.available_qty for balance in target_balances), ZERO)
    if target_available >= rule.minimum_qty:
        raise ValidationError({"detail": "Replenishment is not needed because the target location is above the minimum qty"})
    needed_qty = rule.target_qty - target_available
    if needed_qty <= ZERO:
        raise ValidationError({"detail": "Replenishment is not needed because the target location already meets the target qty"})

    source_balances = [
        balance
        for balance in InventoryBalance.objects.select_for_update().filter(
            openid=openid,
            is_delete=False,
            warehouse=rule.warehouse,
            location=rule.source_location,
            goods=rule.goods,
            stock_status=rule.stock_status,
        )
        if balance.available_qty > ZERO
    ]
    source_balances.sort(key=lambda balance: (balance.last_movement_at or balance.create_time, balance.id))
    if not source_balances:
        raise ValidationError({"detail": "No available source inventory can satisfy the replenishment rule"})
    source_balance = source_balances[0]
    task_qty = min(needed_qty, source_balance.available_qty)
    if task_qty <= ZERO:
        raise ValidationError({"detail": "No source inventory is available for replenishment"})

    assigned_to = payload.assigned_to
    if assigned_to is not None:
        ensure_tenant_match(assigned_to, openid, "Assigned staff")
        if assigned_to.is_lock:
            raise ValidationError({"detail": "Assigned operator is locked"})

    task_number = f"RPL-{rule.id}-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"
    task = ReplenishmentTask.objects.create(
        replenishment_rule=rule,
        warehouse=rule.warehouse,
        source_balance=source_balance,
        goods=rule.goods,
        task_number=task_number[:64],
        from_location=rule.source_location,
        to_location=rule.target_location,
        quantity=task_qty,
        priority=rule.priority,
        stock_status=rule.stock_status,
        lot_number=source_balance.lot_number,
        serial_number=source_balance.serial_number,
        status=ReplenishmentTaskStatus.ASSIGNED if assigned_to is not None else ReplenishmentTaskStatus.OPEN,
        assigned_to=assigned_to,
        notes=rule.notes,
        generated_at=timezone.now(),
        creator=operator_name,
        openid=openid,
    )
    return task


@transaction.atomic
def update_replenishment_task(
    *,
    openid: str,
    replenishment_task: ReplenishmentTask,
    payload: ReplenishmentTaskUpdatePayload,
) -> ReplenishmentTask:
    ensure_tenant_match(replenishment_task, openid, "Replenishment task")
    task = ReplenishmentTask.objects.select_for_update().get(pk=replenishment_task.pk)
    if task.status == ReplenishmentTaskStatus.COMPLETED:
        raise ValidationError({"detail": "Completed replenishment tasks cannot be updated"})
    if payload.assigned_to is not None:
        ensure_tenant_match(payload.assigned_to, openid, "Assigned staff")
        if payload.assigned_to.is_lock:
            raise ValidationError({"detail": "Assigned operator is locked"})
    if payload.to_location is not None:
        _validate_transfer_locations(
            warehouse=task.warehouse,
            from_location=task.from_location,
            to_location=payload.to_location,
            openid=openid,
        )
        task.to_location = payload.to_location
    task.assigned_to = payload.assigned_to
    task.notes = payload.notes
    if payload.status == ReplenishmentTaskStatus.CANCELLED:
        task.status = ReplenishmentTaskStatus.CANCELLED
    elif payload.assigned_to is not None:
        task.status = ReplenishmentTaskStatus.ASSIGNED
    elif task.status == ReplenishmentTaskStatus.ASSIGNED and payload.assigned_to is None:
        task.status = ReplenishmentTaskStatus.OPEN
    task.save(update_fields=["to_location", "assigned_to", "notes", "status", "update_time"])
    return task


@transaction.atomic
def complete_replenishment_task(
    *,
    openid: str,
    operator_name: str,
    replenishment_task: ReplenishmentTask,
    to_location=None,
) -> ReplenishmentTask:
    ensure_tenant_match(replenishment_task, openid, "Replenishment task")
    task = (
        ReplenishmentTask.objects.select_for_update()
        .select_related("warehouse", "goods", "source_balance", "from_location", "to_location")
        .get(pk=replenishment_task.pk)
    )
    if task.status == ReplenishmentTaskStatus.COMPLETED:
        raise ValidationError({"detail": "Replenishment task is already completed"})
    if task.status == ReplenishmentTaskStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled replenishment tasks cannot be completed"})
    destination = to_location or task.to_location
    _validate_transfer_locations(
        warehouse=task.warehouse,
        from_location=task.from_location,
        to_location=destination,
        openid=openid,
    )
    ensure_tenant_match(task.source_balance, openid, "Source balance")
    ensure_location_usable(destination)
    if destination.zone.usage not in {ZoneUsage.PICKING, ZoneUsage.STORAGE, ZoneUsage.SHIPPING}:
        raise ValidationError({"detail": "Replenishment destination must be a usable storage, picking, or shipping location"})
    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=task.warehouse,
        goods=task.goods,
        movement_type=MovementType.TRANSFER,
        quantity=task.quantity,
        stock_status=task.stock_status,
        lot_number=task.lot_number,
        serial_number=task.serial_number,
        unit_cost=task.source_balance.unit_cost,
        from_location=task.from_location,
        to_location=destination,
        reference_code=task.task_number,
        reason=(task.notes or task.task_number)[:255],
    )
    task.to_location = destination
    task.status = ReplenishmentTaskStatus.COMPLETED
    task.completed_by = operator_name
    task.completed_at = timezone.now()
    task.inventory_movement = movement
    task.save(
        update_fields=[
            "to_location",
            "status",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "update_time",
        ]
    )
    return task
