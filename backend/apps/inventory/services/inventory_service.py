from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.inventory.models import (
    AdjustmentDirection,
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
    InventoryStatus,
    MovementType,
)
from apps.locations.models import Location
from apps.organizations.models import Organization
from apps.products.models import Product
from apps.warehouse.models import Warehouse


_UNSET = object()
_INCREASE_MOVEMENT_TYPES = {
    MovementType.OPENING,
    MovementType.RECEIPT,
    MovementType.ADJUSTMENT_IN,
}
_DECREASE_MOVEMENT_TYPES = {
    MovementType.PICK,
    MovementType.SHIP,
    MovementType.ADJUSTMENT_OUT,
}
_TRANSFER_MOVEMENT_TYPES = {
    MovementType.PUTAWAY,
    MovementType.TRANSFER,
}


@dataclass(frozen=True, slots=True)
class CreateInventoryMovementInput:
    organization: Organization
    warehouse: Warehouse
    product: Product
    movement_type: str
    quantity: Decimal
    performed_by: str
    from_location: Location | None = None
    to_location: Location | None = None
    stock_status: str = InventoryStatus.AVAILABLE
    lot_number: str = ""
    serial_number: str = ""
    unit_cost: Decimal = Decimal("0.0000")
    currency: str = "USD"
    reference_code: str = ""
    reason: str = ""
    occurred_at: datetime | None = None


@dataclass(frozen=True, slots=True)
class CreateInventoryHoldInput:
    organization: Organization
    inventory_balance: InventoryBalance
    quantity: Decimal
    reason: str
    held_by: str
    reference_code: str = ""
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CreateInventoryAdjustmentReasonInput:
    organization: Organization
    code: str
    name: str
    description: str = ""
    direction: str = AdjustmentDirection.BOTH
    requires_approval: bool = False
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateInventoryAdjustmentApprovalRuleInput:
    organization: Organization
    adjustment_reason: InventoryAdjustmentReason
    warehouse: Warehouse | None = None
    minimum_variance_qty: Decimal = Decimal("0.0000")
    approver_role: str = ""
    is_active: bool = True
    notes: str = ""


def list_organization_inventory_balances(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    location_id: int | None = None,
    product_id: int | None = None,
    stock_status: str | None = None,
) -> list[InventoryBalance]:
    queryset = InventoryBalance.objects.select_related("warehouse", "location", "product").filter(
        organization=organization
    )
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if location_id is not None:
        queryset = queryset.filter(location_id=location_id)
    if product_id is not None:
        queryset = queryset.filter(product_id=product_id)
    if stock_status is not None:
        queryset = queryset.filter(stock_status=stock_status)
    return list(queryset.order_by("warehouse__name", "location__code", "product__sku", "id"))


def list_organization_inventory_movements(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    product_id: int | None = None,
    movement_type: str | None = None,
) -> list[InventoryMovement]:
    queryset = InventoryMovement.objects.select_related(
        "warehouse",
        "product",
        "from_location",
        "to_location",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if product_id is not None:
        queryset = queryset.filter(product_id=product_id)
    if movement_type is not None:
        queryset = queryset.filter(movement_type=movement_type)
    return list(queryset.order_by("-occurred_at", "-id"))


def list_organization_inventory_holds(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    product_id: int | None = None,
    is_active: bool | None = None,
) -> list[InventoryHold]:
    queryset = InventoryHold.objects.select_related(
        "inventory_balance",
        "inventory_balance__warehouse",
        "inventory_balance__product",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(inventory_balance__warehouse_id=warehouse_id)
    if product_id is not None:
        queryset = queryset.filter(inventory_balance__product_id=product_id)
    if is_active is not None:
        queryset = queryset.filter(is_active=is_active)
    return list(queryset.order_by("-id"))


def list_inventory_adjustment_reasons(*, organization: Organization) -> list[InventoryAdjustmentReason]:
    return list(
        InventoryAdjustmentReason.objects.filter(organization=organization).order_by("code", "id")
    )


def list_inventory_adjustment_approval_rules(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
) -> list[InventoryAdjustmentApprovalRule]:
    queryset = InventoryAdjustmentApprovalRule.objects.select_related(
        "adjustment_reason",
        "warehouse",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    return list(queryset.order_by("adjustment_reason__code", "-minimum_variance_qty", "approver_role", "id"))


def _validate_scope(
    *,
    organization: Organization,
    warehouse: Warehouse,
    product: Product,
    from_location: Location | None,
    to_location: Location | None,
) -> None:
    errors: dict[str, str] = {}
    if warehouse.organization_id != organization.id:
        errors["warehouse"] = "Warehouse must belong to the same organization as the movement."
    if product.organization_id != organization.id:
        errors["product"] = "Product must belong to the same organization as the movement."
    if from_location is not None:
        if from_location.organization_id != organization.id:
            errors["from_location"] = "Source location must belong to the same organization as the movement."
        if from_location.warehouse_id != warehouse.id:
            errors["from_location"] = "Source location must belong to the provided warehouse."
    if to_location is not None:
        if to_location.organization_id != organization.id:
            errors["to_location"] = "Destination location must belong to the same organization as the movement."
        if to_location.warehouse_id != warehouse.id:
            errors["to_location"] = "Destination location must belong to the provided warehouse."
    if errors:
        raise ValidationError(errors)


def _get_or_create_balance(
    *,
    organization: Organization,
    warehouse: Warehouse,
    location: Location,
    product: Product,
    stock_status: str,
    lot_number: str,
    serial_number: str,
    unit_cost: Decimal,
    currency: str,
    occurred_at: datetime,
) -> InventoryBalance:
    balance, created = InventoryBalance.objects.get_or_create(
        organization=organization,
        warehouse=warehouse,
        location=location,
        product=product,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        defaults={
            "unit_cost": unit_cost,
            "currency": currency,
            "last_movement_at": occurred_at,
        },
    )
    if created:
        return balance
    changed = False
    if unit_cost and balance.unit_cost != unit_cost:
        balance.unit_cost = unit_cost
        changed = True
    if currency and balance.currency != currency:
        balance.currency = currency
        changed = True
    if balance.last_movement_at is None or balance.last_movement_at < occurred_at:
        balance.last_movement_at = occurred_at
        changed = True
    if changed:
        balance.save()
    return balance


def _decrease_balance(balance: InventoryBalance, quantity: Decimal, occurred_at: datetime) -> InventoryBalance:
    if balance.available_qty < quantity:
        raise ValidationError({"quantity": "Insufficient available quantity for the requested movement."})
    balance.on_hand_qty -= quantity
    balance.last_movement_at = occurred_at
    balance.save()
    return balance


def _increase_balance(balance: InventoryBalance, quantity: Decimal, occurred_at: datetime) -> InventoryBalance:
    balance.on_hand_qty += quantity
    balance.last_movement_at = occurred_at
    balance.save()
    return balance


@transaction.atomic
def record_inventory_movement(payload: CreateInventoryMovementInput) -> InventoryMovement:
    occurred_at = payload.occurred_at or timezone.now()
    _validate_scope(
        organization=payload.organization,
        warehouse=payload.warehouse,
        product=payload.product,
        from_location=payload.from_location,
        to_location=payload.to_location,
    )
    lot_number = payload.lot_number.strip()
    serial_number = payload.serial_number.strip()
    currency = payload.currency.strip().upper() or "USD"

    resulting_from_qty: Decimal | None = None
    resulting_to_qty: Decimal | None = None

    if payload.movement_type in _INCREASE_MOVEMENT_TYPES:
        if payload.to_location is None:
            raise ValidationError({"to_location": "Destination location is required for inbound movements."})
        to_balance = _get_or_create_balance(
            organization=payload.organization,
            warehouse=payload.warehouse,
            location=payload.to_location,
            product=payload.product,
            stock_status=payload.stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            unit_cost=payload.unit_cost,
            currency=currency,
            occurred_at=occurred_at,
        )
        resulting_to_qty = _increase_balance(to_balance, payload.quantity, occurred_at).on_hand_qty
    elif payload.movement_type in _DECREASE_MOVEMENT_TYPES:
        if payload.from_location is None:
            raise ValidationError({"from_location": "Source location is required for outbound movements."})
        from_balance = _get_or_create_balance(
            organization=payload.organization,
            warehouse=payload.warehouse,
            location=payload.from_location,
            product=payload.product,
            stock_status=payload.stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            unit_cost=payload.unit_cost,
            currency=currency,
            occurred_at=occurred_at,
        )
        resulting_from_qty = _decrease_balance(from_balance, payload.quantity, occurred_at).on_hand_qty
    elif payload.movement_type in _TRANSFER_MOVEMENT_TYPES:
        if payload.from_location is None or payload.to_location is None:
            raise ValidationError({"movement_type": "Transfer movements require both source and destination locations."})
        if payload.from_location.id == payload.to_location.id:
            raise ValidationError({"to_location": "Destination location must be different from source location."})
        from_balance = _get_or_create_balance(
            organization=payload.organization,
            warehouse=payload.warehouse,
            location=payload.from_location,
            product=payload.product,
            stock_status=payload.stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            unit_cost=payload.unit_cost,
            currency=currency,
            occurred_at=occurred_at,
        )
        to_balance = _get_or_create_balance(
            organization=payload.organization,
            warehouse=payload.warehouse,
            location=payload.to_location,
            product=payload.product,
            stock_status=payload.stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            unit_cost=payload.unit_cost,
            currency=currency,
            occurred_at=occurred_at,
        )
        resulting_from_qty = _decrease_balance(from_balance, payload.quantity, occurred_at).on_hand_qty
        resulting_to_qty = _increase_balance(to_balance, payload.quantity, occurred_at).on_hand_qty
    else:
        raise ValidationError({"movement_type": "Unsupported movement type for direct inventory recording."})

    movement = InventoryMovement(
        organization=payload.organization,
        warehouse=payload.warehouse,
        product=payload.product,
        from_location=payload.from_location,
        to_location=payload.to_location,
        movement_type=payload.movement_type,
        stock_status=payload.stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        quantity=payload.quantity,
        unit_cost=payload.unit_cost,
        currency=currency,
        reference_code=payload.reference_code,
        reason=payload.reason,
        performed_by=payload.performed_by,
        occurred_at=occurred_at,
        resulting_from_qty=resulting_from_qty,
        resulting_to_qty=resulting_to_qty,
    )
    movement.save()
    return movement


@transaction.atomic
def create_inventory_hold(payload: CreateInventoryHoldInput) -> InventoryHold:
    balance = payload.inventory_balance
    if balance.organization_id != payload.organization.id:
        raise ValidationError({"inventory_balance": "Inventory balance must belong to the same organization as the hold."})
    if balance.available_qty < payload.quantity:
        raise ValidationError({"quantity": "Insufficient available quantity for hold."})

    balance.hold_qty += payload.quantity
    balance.last_movement_at = timezone.now()
    balance.save()

    hold = InventoryHold(
        organization=payload.organization,
        inventory_balance=balance,
        quantity=payload.quantity,
        reason=payload.reason,
        reference_code=payload.reference_code,
        notes=payload.notes,
        held_by=payload.held_by,
        is_active=True,
    )
    hold.save()

    InventoryMovement.objects.create(
        organization=payload.organization,
        warehouse=balance.warehouse,
        product=balance.product,
        from_location=balance.location,
        movement_type=MovementType.HOLD,
        stock_status=balance.stock_status,
        lot_number=balance.lot_number,
        serial_number=balance.serial_number,
        quantity=payload.quantity,
        unit_cost=balance.unit_cost,
        currency=balance.currency,
        reference_code=payload.reference_code,
        reason=payload.reason,
        performed_by=payload.held_by,
        occurred_at=timezone.now(),
        resulting_from_qty=balance.on_hand_qty,
    )
    return hold


@transaction.atomic
def release_inventory_hold(
    hold: InventoryHold,
    *,
    released_by: str,
    notes: str | None = None,
    released_at: datetime | None = None,
) -> InventoryHold:
    if not hold.is_active:
        raise ValidationError({"is_active": "Inventory hold is already released."})
    balance = hold.inventory_balance
    balance.hold_qty -= hold.quantity
    if balance.hold_qty < Decimal("0.0000"):
        raise ValidationError({"quantity": "Inventory hold would reduce hold quantity below zero."})
    balance.last_movement_at = released_at or timezone.now()
    balance.save()

    hold.is_active = False
    hold.released_by = released_by
    hold.released_at = released_at or timezone.now()
    if notes is not None:
        hold.notes = notes
    hold.save()

    InventoryMovement.objects.create(
        organization=hold.organization,
        warehouse=balance.warehouse,
        product=balance.product,
        to_location=balance.location,
        movement_type=MovementType.RELEASE_HOLD,
        stock_status=balance.stock_status,
        lot_number=balance.lot_number,
        serial_number=balance.serial_number,
        quantity=hold.quantity,
        unit_cost=balance.unit_cost,
        currency=balance.currency,
        reference_code=hold.reference_code,
        reason=hold.reason,
        performed_by=released_by,
        occurred_at=hold.released_at,
        resulting_to_qty=balance.on_hand_qty,
    )
    return hold


def update_inventory_hold(
    hold: InventoryHold,
    *,
    reason: str | None = None,
    reference_code: str | None = None,
    notes: str | None = None,
) -> InventoryHold:
    if reason is not None:
        hold.reason = reason
    if reference_code is not None:
        hold.reference_code = reference_code
    if notes is not None:
        hold.notes = notes
    hold.save()
    return hold


def create_inventory_adjustment_reason(
    payload: CreateInventoryAdjustmentReasonInput,
) -> InventoryAdjustmentReason:
    reason = InventoryAdjustmentReason(
        organization=payload.organization,
        code=payload.code,
        name=payload.name,
        description=payload.description,
        direction=payload.direction,
        requires_approval=payload.requires_approval,
        is_active=payload.is_active,
    )
    reason.save()
    return reason


def update_inventory_adjustment_reason(
    reason: InventoryAdjustmentReason,
    *,
    code: str | None = None,
    name: str | None = None,
    description: str | None = None,
    direction: str | None = None,
    requires_approval: bool | None = None,
    is_active: bool | None = None,
) -> InventoryAdjustmentReason:
    if code is not None:
        reason.code = code
    if name is not None:
        reason.name = name
    if description is not None:
        reason.description = description
    if direction is not None:
        reason.direction = direction
    if requires_approval is not None:
        reason.requires_approval = requires_approval
    if is_active is not None:
        reason.is_active = is_active
    reason.save()
    return reason


def create_inventory_adjustment_approval_rule(
    payload: CreateInventoryAdjustmentApprovalRuleInput,
) -> InventoryAdjustmentApprovalRule:
    rule = InventoryAdjustmentApprovalRule(
        organization=payload.organization,
        adjustment_reason=payload.adjustment_reason,
        warehouse=payload.warehouse,
        minimum_variance_qty=payload.minimum_variance_qty,
        approver_role=payload.approver_role,
        is_active=payload.is_active,
        notes=payload.notes,
    )
    rule.save()
    return rule


def update_inventory_adjustment_approval_rule(
    rule: InventoryAdjustmentApprovalRule,
    *,
    adjustment_reason: InventoryAdjustmentReason | None = None,
    warehouse: Warehouse | None | object = _UNSET,
    minimum_variance_qty: Decimal | None = None,
    approver_role: str | None = None,
    is_active: bool | None = None,
    notes: str | None = None,
) -> InventoryAdjustmentApprovalRule:
    if adjustment_reason is not None:
        rule.adjustment_reason = adjustment_reason
    if warehouse is not _UNSET:
        rule.warehouse = warehouse
    if minimum_variance_qty is not None:
        rule.minimum_variance_qty = minimum_variance_qty
    if approver_role is not None:
        rule.approver_role = approver_role
    if is_active is not None:
        rule.is_active = is_active
    if notes is not None:
        rule.notes = notes
    rule.save()
    return rule
