"""Domain services for inventory balances, movements, and holds."""

from __future__ import annotations

from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException

from catalog.goods.models import ListModel as Goods
from locations.models import Location, LocationStatus
from warehouse.models import Warehouse

from .models import InventoryBalance, InventoryHold, InventoryMovement, InventoryStatus, MovementType

ZERO = Decimal("0.0000")
INBOUND_MOVEMENTS = {MovementType.OPENING, MovementType.RECEIPT, MovementType.PUTAWAY, MovementType.ADJUSTMENT_IN}
OUTBOUND_MOVEMENTS = {MovementType.PICK, MovementType.SHIP, MovementType.ADJUSTMENT_OUT}


def ensure_tenant_match(obj: object, openid: str, label: str) -> None:
    if getattr(obj, "is_delete", False) or getattr(obj, "openid", None) != openid:
        raise APIException({"detail": f"{label} does not belong to the authenticated tenant"})


def validate_balance_quantities(balance: InventoryBalance) -> None:
    if balance.allocated_qty + balance.hold_qty > balance.on_hand_qty:
        raise APIException({"detail": "Allocated qty plus hold qty cannot exceed on-hand qty"})


def ensure_location_usable(location: Location, *, allow_locked: bool = False) -> None:
    if location.status == LocationStatus.MAINTENANCE:
        raise APIException({"detail": f"Location {location.location_code} is under maintenance"})
    if not allow_locked and location.is_locked:
        raise APIException({"detail": f"Location {location.location_code} is locked"})


def get_or_create_balance(
    *,
    openid: str,
    warehouse: Warehouse,
    location: Location,
    goods: Goods,
    stock_status: str,
    lot_number: str,
    serial_number: str,
    creator: str,
    unit_cost: Decimal,
) -> InventoryBalance:
    balance, created = InventoryBalance.objects.select_for_update().get_or_create(
        openid=openid,
        warehouse=warehouse,
        location=location,
        goods=goods,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        is_delete=False,
        defaults={"creator": creator, "unit_cost": unit_cost},
    )
    if created:
        balance.allocated_qty = ZERO
        balance.hold_qty = ZERO
    return balance


@transaction.atomic
def record_inventory_movement(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    goods: Goods,
    movement_type: str,
    quantity: Decimal,
    stock_status: str,
    lot_number: str,
    serial_number: str,
    unit_cost: Decimal,
    from_location: Location | None = None,
    to_location: Location | None = None,
    reference_code: str = "",
    reason: str = "",
) -> InventoryMovement:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(goods, openid, "Goods")

    if movement_type in INBOUND_MOVEMENTS and to_location is None:
        raise APIException({"detail": "Inbound movements require a destination location"})
    if movement_type in INBOUND_MOVEMENTS and from_location is not None:
        raise APIException({"detail": "Inbound movements cannot include a source location"})
    if movement_type in OUTBOUND_MOVEMENTS and from_location is None:
        raise APIException({"detail": "Outbound movements require a source location"})
    if movement_type in OUTBOUND_MOVEMENTS and to_location is not None:
        raise APIException({"detail": "Outbound movements cannot include a destination location"})
    if movement_type == MovementType.TRANSFER and (from_location is None or to_location is None):
        raise APIException({"detail": "Transfers require both source and destination locations"})
    if from_location is not None and to_location is not None and from_location.pk == to_location.pk and movement_type == MovementType.TRANSFER:
        raise APIException({"detail": "Transfer source and destination cannot be the same"})

    source_balance: InventoryBalance | None = None
    destination_balance: InventoryBalance | None = None
    occurred_at = timezone.now()

    if from_location is not None:
        ensure_tenant_match(from_location, openid, "Source location")
        ensure_location_usable(from_location)
        if from_location.warehouse_id != warehouse.id:
            raise APIException({"detail": "Source location must belong to the selected warehouse"})
        source_balance = InventoryBalance.objects.select_for_update().filter(
            openid=openid,
            warehouse=warehouse,
            location=from_location,
            goods=goods,
            stock_status=stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            is_delete=False,
        ).first()
        if source_balance is None:
            raise APIException({"detail": "No inventory balance exists for the requested source location"})
        if source_balance.on_hand_qty - quantity < source_balance.allocated_qty + source_balance.hold_qty:
            raise APIException({"detail": "Movement would reduce stock below allocated or held quantities"})
        source_balance.on_hand_qty -= quantity
        source_balance.last_movement_at = occurred_at
        validate_balance_quantities(source_balance)
        source_balance.save(update_fields=["on_hand_qty", "last_movement_at", "update_time"])

    if to_location is not None:
        ensure_tenant_match(to_location, openid, "Destination location")
        ensure_location_usable(to_location)
        if to_location.warehouse_id != warehouse.id:
            raise APIException({"detail": "Destination location must belong to the selected warehouse"})
        destination_balance = get_or_create_balance(
            openid=openid,
            warehouse=warehouse,
            location=to_location,
            goods=goods,
            stock_status=stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            creator=operator_name,
            unit_cost=unit_cost,
        )
        destination_balance.on_hand_qty += quantity
        destination_balance.last_movement_at = occurred_at
        if unit_cost > ZERO:
            destination_balance.unit_cost = unit_cost
        validate_balance_quantities(destination_balance)
        destination_balance.save(update_fields=["on_hand_qty", "unit_cost", "last_movement_at", "update_time"])

    movement = InventoryMovement.objects.create(
        warehouse=warehouse,
        goods=goods,
        from_location=from_location,
        to_location=to_location,
        movement_type=movement_type,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        quantity=quantity,
        unit_cost=unit_cost,
        reference_code=reference_code,
        reason=reason,
        performed_by=operator_name,
        occurred_at=occurred_at,
        resulting_from_qty=source_balance.on_hand_qty if source_balance else None,
        resulting_to_qty=destination_balance.on_hand_qty if destination_balance else None,
        creator=operator_name,
        openid=openid,
    )
    return movement


@transaction.atomic
def create_inventory_hold(
    *,
    openid: str,
    operator_name: str,
    inventory_balance: InventoryBalance,
    quantity: Decimal,
    reason: str,
    reference_code: str = "",
    notes: str = "",
) -> InventoryHold:
    ensure_tenant_match(inventory_balance, openid, "Inventory balance")
    ensure_location_usable(inventory_balance.location, allow_locked=True)
    if quantity > inventory_balance.available_qty:
        raise APIException({"detail": "Hold quantity cannot exceed available quantity"})

    inventory_balance = InventoryBalance.objects.select_for_update().get(pk=inventory_balance.pk)
    inventory_balance.hold_qty += quantity
    inventory_balance.last_movement_at = timezone.now()
    validate_balance_quantities(inventory_balance)
    inventory_balance.save(update_fields=["hold_qty", "last_movement_at", "update_time"])

    hold = InventoryHold.objects.create(
        inventory_balance=inventory_balance,
        quantity=quantity,
        reason=reason,
        reference_code=reference_code,
        notes=notes,
        held_by=operator_name,
        creator=operator_name,
        openid=openid,
    )
    InventoryMovement.objects.create(
        warehouse=inventory_balance.warehouse,
        goods=inventory_balance.goods,
        from_location=inventory_balance.location,
        to_location=inventory_balance.location,
        movement_type=MovementType.HOLD,
        stock_status=inventory_balance.stock_status,
        lot_number=inventory_balance.lot_number,
        serial_number=inventory_balance.serial_number,
        quantity=quantity,
        unit_cost=inventory_balance.unit_cost,
        reference_code=reference_code,
        reason=reason,
        performed_by=operator_name,
        resulting_from_qty=inventory_balance.on_hand_qty,
        resulting_to_qty=inventory_balance.on_hand_qty,
        creator=operator_name,
        openid=openid,
    )
    return hold


@transaction.atomic
def release_inventory_hold(
    *,
    openid: str,
    operator_name: str,
    hold: InventoryHold,
) -> InventoryHold:
    ensure_tenant_match(hold, openid, "Inventory hold")
    if not hold.is_active:
        return hold

    hold = InventoryHold.objects.select_for_update().select_related("inventory_balance").get(pk=hold.pk)
    balance = hold.inventory_balance
    if balance.hold_qty < hold.quantity:
        raise APIException({"detail": "Balance hold quantity is lower than the hold being released"})
    balance.hold_qty -= hold.quantity
    balance.last_movement_at = timezone.now()
    validate_balance_quantities(balance)
    balance.save(update_fields=["hold_qty", "last_movement_at", "update_time"])

    hold.is_active = False
    hold.released_by = operator_name
    hold.released_at = timezone.now()
    hold.save(update_fields=["is_active", "released_by", "released_at", "update_time"])

    InventoryMovement.objects.create(
        warehouse=balance.warehouse,
        goods=balance.goods,
        from_location=balance.location,
        to_location=balance.location,
        movement_type=MovementType.RELEASE_HOLD,
        stock_status=balance.stock_status,
        lot_number=balance.lot_number,
        serial_number=balance.serial_number,
        quantity=hold.quantity,
        unit_cost=balance.unit_cost,
        reference_code=hold.reference_code,
        reason=hold.reason,
        performed_by=operator_name,
        resulting_from_qty=balance.on_hand_qty,
        resulting_to_qty=balance.on_hand_qty,
        creator=operator_name,
        openid=openid,
    )
    return hold
