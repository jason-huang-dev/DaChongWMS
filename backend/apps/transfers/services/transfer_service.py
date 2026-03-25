from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import InventoryBalance, InventoryMovement, InventoryStatus, MovementType
from apps.inventory.services.inventory_service import CreateInventoryMovementInput, record_inventory_movement
from apps.locations.models import Location, LocationStatus, ZoneUsage
from apps.organizations.models import Organization, OrganizationMembership
from apps.products.models import Product
from apps.transfers.models import (
    ReplenishmentRule,
    ReplenishmentTask,
    ReplenishmentTaskStatus,
    TransferLine,
    TransferLineStatus,
    TransferOrder,
    TransferOrderStatus,
)
from apps.warehouse.models import Warehouse

_UNSET = object()
ZERO = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class CreateTransferLineInput:
    line_number: int
    product: Product
    from_location: Location
    to_location: Location
    requested_qty: Decimal
    stock_status: str = InventoryStatus.AVAILABLE
    lot_number: str = ""
    serial_number: str = ""
    notes: str = ""
    assigned_membership: OrganizationMembership | None = None


@dataclass(frozen=True, slots=True)
class CreateTransferOrderInput:
    organization: Organization
    warehouse: Warehouse
    transfer_number: str
    requested_date: date | None = None
    reference_code: str = ""
    notes: str = ""
    line_items: tuple[CreateTransferLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class CreateReplenishmentRuleInput:
    organization: Organization
    warehouse: Warehouse
    product: Product
    source_location: Location
    target_location: Location
    minimum_qty: Decimal
    target_qty: Decimal
    stock_status: str = InventoryStatus.AVAILABLE
    priority: int = 100
    is_active: bool = True
    notes: str = ""


def _validate_assignment(assignment: OrganizationMembership | None, organization: Organization) -> None:
    if assignment is None:
        return
    if assignment.organization_id != organization.id:
        raise ValidationError({"assigned_membership": "Assigned membership must belong to the same organization."})
    if not assignment.is_active:
        raise ValidationError({"assigned_membership": "Assigned membership must be active."})


def _ensure_location_usable(location: Location, *, field_name: str) -> None:
    if not location.is_active:
        raise ValidationError({field_name: "Location must be active."})
    if location.is_locked:
        raise ValidationError({field_name: "Location is currently locked."})
    if location.status != LocationStatus.AVAILABLE:
        raise ValidationError({field_name: "Location is not available for movements."})


def _validate_transfer_locations(
    *,
    organization: Organization,
    warehouse: Warehouse,
    from_location: Location,
    to_location: Location,
) -> None:
    errors: dict[str, str] = {}
    if warehouse.organization_id != organization.id:
        errors["warehouse"] = "Warehouse must belong to the same organization."
    if from_location.organization_id != organization.id:
        errors["from_location"] = "Source location must belong to the same organization."
    if to_location.organization_id != organization.id:
        errors["to_location"] = "Destination location must belong to the same organization."
    if from_location.warehouse_id != warehouse.id:
        errors["from_location"] = "Source location must belong to the selected warehouse."
    if to_location.warehouse_id != warehouse.id:
        errors["to_location"] = "Destination location must belong to the selected warehouse."
    if from_location.id == to_location.id:
        errors["to_location"] = "Destination location must be different from source location."
    if errors:
        raise ValidationError(errors)
    _ensure_location_usable(from_location, field_name="from_location")
    _ensure_location_usable(to_location, field_name="to_location")


def _refresh_transfer_order_status(transfer_order: TransferOrder) -> TransferOrder:
    lines = list(transfer_order.lines.all())
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


def list_organization_transfer_orders(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
) -> list[TransferOrder]:
    queryset = TransferOrder.objects.select_related("warehouse").prefetch_related("lines").filter(
        organization=organization
    )
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    return list(queryset.order_by("-create_time", "-id"))


@transaction.atomic
def create_transfer_order(payload: CreateTransferOrderInput) -> TransferOrder:
    if not payload.line_items:
        raise ValidationError({"line_items": "Transfer orders require at least one line item."})
    if payload.warehouse.organization_id != payload.organization.id:
        raise ValidationError({"warehouse": "Warehouse must belong to the same organization as the transfer order."})

    transfer_order = TransferOrder(
        organization=payload.organization,
        warehouse=payload.warehouse,
        transfer_number=payload.transfer_number,
        requested_date=payload.requested_date,
        reference_code=payload.reference_code,
        notes=payload.notes,
    )
    transfer_order.save()

    seen_line_numbers: set[int] = set()
    for item in payload.line_items:
        if item.line_number in seen_line_numbers:
            raise ValidationError({"line_items": "Transfer order line numbers must be unique."})
        seen_line_numbers.add(item.line_number)
        if item.product.organization_id != payload.organization.id:
            raise ValidationError({"line_items": "Each transfer line product must belong to the same organization."})
        _validate_transfer_locations(
            organization=payload.organization,
            warehouse=payload.warehouse,
            from_location=item.from_location,
            to_location=item.to_location,
        )
        _validate_assignment(item.assigned_membership, payload.organization)
        line = TransferLine(
            organization=payload.organization,
            transfer_order=transfer_order,
            line_number=item.line_number,
            product=item.product,
            from_location=item.from_location,
            to_location=item.to_location,
            requested_qty=item.requested_qty,
            stock_status=item.stock_status,
            lot_number=item.lot_number,
            serial_number=item.serial_number,
            assigned_membership=item.assigned_membership,
            notes=item.notes,
        )
        line.save()
    return transfer_order


@transaction.atomic
def update_transfer_order(
    transfer_order: TransferOrder,
    *,
    requested_date: date | None | object = _UNSET,
    reference_code: str | object = _UNSET,
    notes: str | object = _UNSET,
    status: str | object = _UNSET,
) -> TransferOrder:
    transfer_order = TransferOrder.objects.select_for_update().get(pk=transfer_order.pk)
    if transfer_order.status == TransferOrderStatus.COMPLETED:
        raise ValidationError({"status": "Completed transfer orders cannot be updated."})
    if requested_date is not _UNSET:
        transfer_order.requested_date = requested_date
    if reference_code is not _UNSET:
        transfer_order.reference_code = reference_code
    if notes is not _UNSET:
        transfer_order.notes = notes
    if status is not _UNSET:
        if status == TransferOrderStatus.CANCELLED and transfer_order.status == TransferOrderStatus.IN_PROGRESS:
            raise ValidationError({"status": "In-progress transfer orders cannot be cancelled."})
        if status == TransferOrderStatus.CANCELLED:
            transfer_order.status = TransferOrderStatus.CANCELLED
            transfer_order.lines.filter(status=TransferLineStatus.OPEN).update(
                status=TransferLineStatus.CANCELLED,
                update_time=timezone.now(),
            )
    transfer_order.save()
    return _refresh_transfer_order_status(transfer_order)


def list_organization_transfer_lines(
    *,
    organization: Organization,
    transfer_order_id: int | None = None,
    warehouse_id: int | None = None,
    status: str | None = None,
    assigned_membership_id: int | None = None,
) -> list[TransferLine]:
    queryset = TransferLine.objects.select_related(
        "transfer_order",
        "transfer_order__warehouse",
        "product",
        "from_location",
        "to_location",
        "assigned_membership",
        "inventory_movement",
    ).filter(organization=organization)
    if transfer_order_id is not None:
        queryset = queryset.filter(transfer_order_id=transfer_order_id)
    if warehouse_id is not None:
        queryset = queryset.filter(transfer_order__warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    if assigned_membership_id is not None:
        queryset = queryset.filter(assigned_membership_id=assigned_membership_id)
    return list(queryset.order_by("transfer_order_id", "line_number", "id"))


@transaction.atomic
def update_transfer_line(
    transfer_line: TransferLine,
    *,
    assigned_membership: OrganizationMembership | None | object = _UNSET,
    to_location: Location | object = _UNSET,
    status: str | object = _UNSET,
    notes: str | object = _UNSET,
) -> TransferLine:
    line = TransferLine.objects.select_for_update(of=("self",)).select_related(
        "transfer_order",
        "transfer_order__warehouse",
    ).get(pk=transfer_line.pk)
    if line.status == TransferLineStatus.COMPLETED:
        raise ValidationError({"status": "Completed transfer lines cannot be updated."})
    if line.transfer_order.status in {TransferOrderStatus.CANCELLED, TransferOrderStatus.COMPLETED}:
        raise ValidationError({"status": "Closed transfer orders cannot be updated."})

    if assigned_membership is not _UNSET:
        _validate_assignment(assigned_membership, line.organization)
        line.assigned_membership = assigned_membership
    if to_location is not _UNSET:
        _validate_transfer_locations(
            organization=line.organization,
            warehouse=line.transfer_order.warehouse,
            from_location=line.from_location,
            to_location=to_location,
        )
        line.to_location = to_location
    if notes is not _UNSET:
        line.notes = notes
    if status is not _UNSET and status == TransferLineStatus.CANCELLED:
        line.status = TransferLineStatus.CANCELLED
    line.save()
    _refresh_transfer_order_status(line.transfer_order)
    return line


@transaction.atomic
def complete_transfer_line(
    transfer_line: TransferLine,
    *,
    operator_name: str,
    to_location: Location | None = None,
) -> TransferLine:
    line = TransferLine.objects.select_for_update(of=("self",)).select_related(
        "transfer_order",
        "transfer_order__warehouse",
        "product",
        "from_location",
        "to_location",
    ).get(pk=transfer_line.pk)
    if line.status == TransferLineStatus.COMPLETED:
        raise ValidationError({"status": "Transfer line is already completed."})
    if line.status == TransferLineStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled transfer lines cannot be completed."})
    if line.transfer_order.status == TransferOrderStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled transfer orders cannot be completed."})

    destination = to_location or line.to_location
    _validate_transfer_locations(
        organization=line.organization,
        warehouse=line.transfer_order.warehouse,
        from_location=line.from_location,
        to_location=destination,
    )
    source_balance = InventoryBalance.objects.select_for_update().filter(
        organization=line.organization,
        warehouse=line.transfer_order.warehouse,
        location=line.from_location,
        product=line.product,
        stock_status=line.stock_status,
        lot_number=line.lot_number,
        serial_number=line.serial_number,
    ).first()
    if source_balance is None:
        raise ValidationError({"from_location": "No inventory balance exists for the requested source location."})
    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=line.organization,
            warehouse=line.transfer_order.warehouse,
            product=line.product,
            movement_type=MovementType.TRANSFER,
            quantity=line.requested_qty,
            performed_by=operator_name,
            from_location=line.from_location,
            to_location=destination,
            stock_status=line.stock_status,
            lot_number=line.lot_number,
            serial_number=line.serial_number,
            unit_cost=source_balance.unit_cost,
            currency=source_balance.currency,
            reference_code=line.transfer_order.transfer_number,
            reason=(line.notes or line.transfer_order.notes)[:255],
        )
    )
    line.to_location = destination
    line.moved_qty = line.requested_qty
    line.status = TransferLineStatus.COMPLETED
    line.completed_by = operator_name
    line.completed_at = timezone.now()
    line.inventory_movement = movement
    line.save()
    _refresh_transfer_order_status(line.transfer_order)
    return line


def list_replenishment_rules(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    product_id: int | None = None,
    is_active: bool | None = None,
) -> list[ReplenishmentRule]:
    queryset = ReplenishmentRule.objects.select_related(
        "warehouse",
        "product",
        "source_location",
        "target_location",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if product_id is not None:
        queryset = queryset.filter(product_id=product_id)
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)
    return list(queryset.order_by("priority", "warehouse__name", "product__sku", "id"))


def create_replenishment_rule(payload: CreateReplenishmentRuleInput) -> ReplenishmentRule:
    if payload.target_qty <= payload.minimum_qty:
        raise ValidationError({"target_qty": "Target quantity must be greater than minimum quantity."})
    _validate_transfer_locations(
        organization=payload.organization,
        warehouse=payload.warehouse,
        from_location=payload.source_location,
        to_location=payload.target_location,
    )
    rule = ReplenishmentRule(
        organization=payload.organization,
        warehouse=payload.warehouse,
        product=payload.product,
        source_location=payload.source_location,
        target_location=payload.target_location,
        minimum_qty=payload.minimum_qty,
        target_qty=payload.target_qty,
        stock_status=payload.stock_status,
        priority=payload.priority,
        is_active=payload.is_active,
        notes=payload.notes,
    )
    rule.save()
    return rule


@transaction.atomic
def update_replenishment_rule(
    replenishment_rule: ReplenishmentRule,
    *,
    warehouse: Warehouse | object = _UNSET,
    product: Product | object = _UNSET,
    source_location: Location | object = _UNSET,
    target_location: Location | object = _UNSET,
    minimum_qty: Decimal | object = _UNSET,
    target_qty: Decimal | object = _UNSET,
    stock_status: str | object = _UNSET,
    priority: int | object = _UNSET,
    is_active: bool | object = _UNSET,
    notes: str | object = _UNSET,
) -> ReplenishmentRule:
    rule = ReplenishmentRule.objects.select_for_update().get(pk=replenishment_rule.pk)
    if warehouse is not _UNSET:
        rule.warehouse = warehouse
    if product is not _UNSET:
        rule.product = product
    if source_location is not _UNSET:
        rule.source_location = source_location
    if target_location is not _UNSET:
        rule.target_location = target_location
    if minimum_qty is not _UNSET:
        rule.minimum_qty = minimum_qty
    if target_qty is not _UNSET:
        rule.target_qty = target_qty
    if stock_status is not _UNSET:
        rule.stock_status = stock_status
    if priority is not _UNSET:
        rule.priority = priority
    if is_active is not _UNSET:
        rule.is_active = is_active
    if notes is not _UNSET:
        rule.notes = notes
    rule.save()
    return rule


def _next_replenishment_task_number(rule: ReplenishmentRule) -> str:
    return f"RPL-{rule.id}-{timezone.now().strftime('%Y%m%d%H%M%S%f')}"[:64]


@transaction.atomic
def generate_replenishment_task(
    replenishment_rule: ReplenishmentRule,
    *,
    assigned_membership: OrganizationMembership | None = None,
) -> ReplenishmentTask:
    rule = ReplenishmentRule.objects.select_for_update(of=("self",)).select_related(
        "warehouse",
        "product",
        "source_location",
        "target_location",
    ).get(pk=replenishment_rule.pk)
    if not rule.is_active:
        raise ValidationError({"is_active": "Inactive replenishment rules cannot generate tasks."})
    if rule.tasks.filter(status__in=[ReplenishmentTaskStatus.OPEN, ReplenishmentTaskStatus.ASSIGNED]).exists():
        raise ValidationError({"status": "This replenishment rule already has an open task."})
    _validate_assignment(assigned_membership, rule.organization)

    target_balances = list(
        InventoryBalance.objects.filter(
            organization=rule.organization,
            warehouse=rule.warehouse,
            location=rule.target_location,
            product=rule.product,
            stock_status=rule.stock_status,
        )
    )
    target_available = sum((balance.available_qty for balance in target_balances), ZERO)
    if target_available >= rule.minimum_qty:
        raise ValidationError({"minimum_qty": "Replenishment is not needed because the target location is above the minimum quantity."})
    needed_qty = rule.target_qty - target_available
    if needed_qty <= ZERO:
        raise ValidationError({"target_qty": "Replenishment is not needed because the target location already meets the target quantity."})

    source_balances = [
        balance
        for balance in InventoryBalance.objects.select_for_update().filter(
            organization=rule.organization,
            warehouse=rule.warehouse,
            location=rule.source_location,
            product=rule.product,
            stock_status=rule.stock_status,
        )
        if balance.available_qty > ZERO
    ]
    source_balances.sort(key=lambda balance: (balance.last_movement_at or timezone.now(), balance.id))
    if not source_balances:
        raise ValidationError({"source_location": "No available source inventory can satisfy the replenishment rule."})
    source_balance = source_balances[0]
    task_qty = min(needed_qty, source_balance.available_qty)
    if task_qty <= ZERO:
        raise ValidationError({"quantity": "No source inventory is available for replenishment."})

    task = ReplenishmentTask(
        organization=rule.organization,
        replenishment_rule=rule,
        warehouse=rule.warehouse,
        source_balance=source_balance,
        product=rule.product,
        task_number=_next_replenishment_task_number(rule),
        from_location=rule.source_location,
        to_location=rule.target_location,
        quantity=task_qty,
        priority=rule.priority,
        stock_status=rule.stock_status,
        lot_number=source_balance.lot_number,
        serial_number=source_balance.serial_number,
        status=ReplenishmentTaskStatus.ASSIGNED if assigned_membership is not None else ReplenishmentTaskStatus.OPEN,
        assigned_membership=assigned_membership,
        notes=rule.notes,
        generated_at=timezone.now(),
    )
    task.save()
    return task


def list_replenishment_tasks(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
    assigned_membership_id: int | None = None,
) -> list[ReplenishmentTask]:
    queryset = ReplenishmentTask.objects.select_related(
        "replenishment_rule",
        "warehouse",
        "source_balance",
        "product",
        "from_location",
        "to_location",
        "assigned_membership",
        "inventory_movement",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    if assigned_membership_id is not None:
        queryset = queryset.filter(assigned_membership_id=assigned_membership_id)
    return list(queryset.order_by("status", "priority", "generated_at", "id"))


@transaction.atomic
def update_replenishment_task(
    replenishment_task: ReplenishmentTask,
    *,
    assigned_membership: OrganizationMembership | None | object = _UNSET,
    to_location: Location | object = _UNSET,
    status: str | object = _UNSET,
    notes: str | object = _UNSET,
) -> ReplenishmentTask:
    task = ReplenishmentTask.objects.select_for_update(of=("self",)).select_related("warehouse").get(
        pk=replenishment_task.pk
    )
    if task.status == ReplenishmentTaskStatus.COMPLETED:
        raise ValidationError({"status": "Completed replenishment tasks cannot be updated."})
    if assigned_membership is not _UNSET:
        _validate_assignment(assigned_membership, task.organization)
        task.assigned_membership = assigned_membership
        if assigned_membership is not None and task.status == ReplenishmentTaskStatus.OPEN:
            task.status = ReplenishmentTaskStatus.ASSIGNED
        elif assigned_membership is None and task.status == ReplenishmentTaskStatus.ASSIGNED:
            task.status = ReplenishmentTaskStatus.OPEN
    if to_location is not _UNSET:
        _validate_transfer_locations(
            organization=task.organization,
            warehouse=task.warehouse,
            from_location=task.from_location,
            to_location=to_location,
        )
        task.to_location = to_location
    if notes is not _UNSET:
        task.notes = notes
    if status is not _UNSET and status == ReplenishmentTaskStatus.CANCELLED:
        task.status = ReplenishmentTaskStatus.CANCELLED
    task.save()
    return task


@transaction.atomic
def complete_replenishment_task(
    replenishment_task: ReplenishmentTask,
    *,
    operator_name: str,
    to_location: Location | None = None,
) -> ReplenishmentTask:
    task = ReplenishmentTask.objects.select_for_update(of=("self",)).select_related(
        "warehouse",
        "source_balance",
        "product",
        "from_location",
        "to_location",
    ).get(pk=replenishment_task.pk)
    if task.status == ReplenishmentTaskStatus.COMPLETED:
        raise ValidationError({"status": "Replenishment task is already completed."})
    if task.status == ReplenishmentTaskStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled replenishment tasks cannot be completed."})
    destination = to_location or task.to_location
    _validate_transfer_locations(
        organization=task.organization,
        warehouse=task.warehouse,
        from_location=task.from_location,
        to_location=destination,
    )
    if destination.zone.usage not in {ZoneUsage.PICKING, ZoneUsage.STORAGE, ZoneUsage.SHIPPING}:
        raise ValidationError({"to_location": "Replenishment destination must be a usable storage, picking, or shipping location."})

    source_balance = InventoryBalance.objects.select_for_update().get(pk=task.source_balance_id)
    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=task.organization,
            warehouse=task.warehouse,
            product=task.product,
            movement_type=MovementType.TRANSFER,
            quantity=task.quantity,
            performed_by=operator_name,
            from_location=task.from_location,
            to_location=destination,
            stock_status=task.stock_status,
            lot_number=task.lot_number,
            serial_number=task.serial_number,
            unit_cost=source_balance.unit_cost,
            currency=source_balance.currency,
            reference_code=task.task_number,
            reason=(task.notes or task.task_number)[:255],
        )
    )
    task.to_location = destination
    task.status = ReplenishmentTaskStatus.COMPLETED
    task.completed_by = operator_name
    task.completed_at = timezone.now()
    task.inventory_movement = movement
    task.save()
    return task
