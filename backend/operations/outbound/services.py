"""Domain services for outbound sales orders, picks, and shipments."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from django.db import transaction
from django.db.models import F
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryStatus, MovementType
from inventory.services import (
    create_inventory_hold,
    ensure_location_usable,
    ensure_tenant_match,
    record_inventory_movement,
    validate_balance_quantities,
)
from locations.models import Location, LocationStatus, ZoneUsage
from scanner.models import LicensePlateStatus
from scanner.services import transition_license_plate
from staff.models import ListModel as Staff
from utils.scanning import (
    resolve_and_validate_scan_attributes,
    resolve_goods_by_scan_code,
    resolve_license_plate_by_scan_code,
    resolve_location_by_scan_code,
)
from warehouse.models import Warehouse

from .models import (
    DockLoadVerification,
    DockLoadVerificationStatus,
    LogisticsTrackingEvent,
    LogisticsTrackingStatus,
    OutboundWave,
    OutboundWaveOrder,
    OutboundWaveStatus,
    PackageExecutionRecord,
    PackageExecutionStatus,
    PackageExecutionStep,
    PickTask,
    PickTaskStatus,
    SalesOrder,
    SalesOrderExceptionState,
    SalesOrderFulfillmentStage,
    SalesOrderLine,
    SalesOrderLineStatus,
    SalesOrderStatus,
    Shipment,
    ShipmentDocumentRecord,
    ShipmentDocumentType,
    ShipmentLine,
    ShortPickRecord,
    ShortPickStatus,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class SalesOrderLinePayload:
    line_number: int
    goods: object
    ordered_qty: Decimal
    unit_price: Decimal
    stock_status: str


@dataclass(frozen=True)
class ShipmentLinePayload:
    sales_order_line: SalesOrderLine
    shipped_qty: Decimal
    stock_status: str
    lot_number: str
    serial_number: str
    from_location: Location | None
    license_plate: object | None = None


@dataclass(frozen=True)
class PickTaskUpdatePayload:
    assigned_to: Staff | None
    to_location: Location | None
    status: str
    notes: str


@dataclass(frozen=True)
class AllocationResult:
    sales_order: SalesOrder
    allocated_tasks: int


@dataclass(frozen=True)
class ScanPickPayload:
    task_number: str
    from_location_barcode: str
    goods_barcode: str
    to_location_barcode: str
    lpn_barcode: str


@dataclass(frozen=True)
class ScanShipmentPayload:
    sales_order_number: str
    shipment_number: str
    staging_location_barcode: str
    goods_barcode: str
    dock_location_barcode: str
    lpn_barcode: str
    attribute_scan: str
    shipped_qty: Decimal
    stock_status: str
    lot_number: str
    serial_number: str
    reference_code: str
    notes: str
    trailer_reference: str


@dataclass(frozen=True)
class ShortPickReportPayload:
    short_qty: Decimal
    picked_qty: Decimal | None
    reason_code: str
    to_location: Location | None
    notes: str


@dataclass(frozen=True)
class ShortPickResolvePayload:
    resolution_notes: str


@dataclass(frozen=True)
class WaveUpdatePayload:
    status: str
    notes: str


@dataclass(frozen=True)
class PackageExecutionPayload:
    shipment: Shipment | None
    wave: OutboundWave | None
    record_number: str
    step_type: str
    execution_status: str
    package_number: str
    scan_code: str
    weight: Decimal | None
    notes: str
    requested_order_type: str = ""


@dataclass(frozen=True)
class ShipmentDocumentPayload:
    shipment: Shipment | None
    wave: OutboundWave | None
    document_number: str
    document_type: str
    reference_code: str
    file_name: str
    notes: str


@dataclass(frozen=True)
class LogisticsTrackingPayload:
    shipment: Shipment | None
    event_number: str
    tracking_number: str
    event_code: str
    event_status: str
    event_location: str
    description: str
    occurred_at: object


def _validate_staging_location(location: Location, *, openid: str, warehouse: Warehouse) -> None:
    ensure_tenant_match(location, openid, "Staging location")
    if location.warehouse_id != warehouse.id:
        raise APIException({"detail": "Staging location must belong to the selected warehouse"})
    ensure_location_usable(location)
    if location.zone.usage != ZoneUsage.SHIPPING:
        raise APIException({"detail": "Staging location must belong to a shipping zone"})


def _line_status(line: SalesOrderLine) -> str:
    if line.status == SalesOrderLineStatus.CANCELLED:
        return SalesOrderLineStatus.CANCELLED
    if line.shipped_qty >= line.ordered_qty:
        return SalesOrderLineStatus.SHIPPED
    if line.picked_qty >= line.ordered_qty and line.allocated_qty == ZERO:
        return SalesOrderLineStatus.PICKED
    if line.allocated_qty >= line.ordered_qty and line.picked_qty == ZERO and line.shipped_qty == ZERO:
        return SalesOrderLineStatus.ALLOCATED
    if line.allocated_qty > ZERO or line.picked_qty > ZERO or line.shipped_qty > ZERO:
        return SalesOrderLineStatus.PARTIAL
    return SalesOrderLineStatus.OPEN


def _derive_sales_order_fulfillment_stage(
    *,
    sales_order: SalesOrder,
    active_lines: list[SalesOrderLine],
) -> str:
    if sales_order.status == SalesOrderStatus.CANCELLED:
        return SalesOrderFulfillmentStage.CANCELLED
    if sales_order.status == SalesOrderStatus.SHIPPED:
        return SalesOrderFulfillmentStage.SHIPPED
    if sales_order.packed_at is not None:
        return SalesOrderFulfillmentStage.TO_SHIP
    if sales_order.status in {SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING, SalesOrderStatus.PICKED}:
        return SalesOrderFulfillmentStage.IN_PROCESS
    if any(line.allocated_qty > ZERO or line.picked_qty > ZERO or line.shipped_qty > ZERO for line in active_lines):
        return SalesOrderFulfillmentStage.IN_PROCESS
    if sales_order.waybill_printed or sales_order.tracking_number or sales_order.waybill_number:
        return SalesOrderFulfillmentStage.TO_MOVE
    return SalesOrderFulfillmentStage.GET_TRACKING_NO


def refresh_sales_order_status(sales_order: SalesOrder) -> SalesOrder:
    lines = list(sales_order.lines.filter(is_delete=False))
    active_lines = [line for line in lines if line.status != SalesOrderLineStatus.CANCELLED]
    if not active_lines:
        sales_order.status = SalesOrderStatus.CANCELLED if lines else SalesOrderStatus.OPEN
    elif all(line.shipped_qty >= line.ordered_qty for line in active_lines):
        sales_order.status = SalesOrderStatus.SHIPPED
    elif all(line.picked_qty + line.shipped_qty >= line.ordered_qty for line in active_lines):
        sales_order.status = SalesOrderStatus.PICKED
    elif any(line.picked_qty > ZERO or line.shipped_qty > ZERO for line in active_lines):
        sales_order.status = SalesOrderStatus.PICKING
    elif any(line.allocated_qty > ZERO for line in active_lines):
        sales_order.status = SalesOrderStatus.ALLOCATED
    else:
        sales_order.status = SalesOrderStatus.OPEN
    if sales_order.status in {SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING, SalesOrderStatus.PICKED, SalesOrderStatus.SHIPPED}:
        if sales_order.picking_started_at is None and any(
            line.allocated_qty > ZERO or line.picked_qty > ZERO or line.shipped_qty > ZERO for line in active_lines
        ):
            sales_order.picking_started_at = timezone.now()
    if sales_order.status in {SalesOrderStatus.PICKED, SalesOrderStatus.SHIPPED}:
        if sales_order.picking_completed_at is None:
            sales_order.picking_completed_at = timezone.now()

    sales_order.fulfillment_stage = _derive_sales_order_fulfillment_stage(
        sales_order=sales_order,
        active_lines=active_lines,
    )
    sales_order.save(
        update_fields=[
            "status",
            "fulfillment_stage",
            "picking_started_at",
            "picking_completed_at",
            "update_time",
        ]
    )
    return sales_order


def _ensure_task_operator(*, task: PickTask, operator: Staff) -> None:
    ensure_tenant_match(operator, task.openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})
    if task.assigned_to_id is not None and task.assigned_to_id != operator.id:
        raise APIException({"detail": "This pick task is assigned to a different operator"})


def _resolve_staging_balance_for_scan(
    *,
    openid: str,
    warehouse: Warehouse,
    location: Location,
    goods,
    stock_status: str,
    lot_number: str,
    serial_number: str,
) -> InventoryBalance:
    balances = InventoryBalance.objects.select_for_update().filter(
        openid=openid,
        warehouse=warehouse,
        location=location,
        goods=goods,
        stock_status=stock_status,
        is_delete=False,
        on_hand_qty__gt=ZERO,
    )
    if lot_number:
        balances = balances.filter(lot_number=lot_number)
    if serial_number:
        balances = balances.filter(serial_number=serial_number)
    matches = list(balances.order_by("id")[:2])
    if not matches:
        raise APIException({"detail": "No staged inventory matched the scanned goods"})
    if len(matches) > 1:
        raise APIException({"detail": "Multiple staged balances matched; scan lot or serial information as well"})
    return matches[0]


def _ensure_shipment_matches_sales_order(*, shipment: Shipment, sales_order: SalesOrder) -> None:
    if shipment.sales_order_id != sales_order.id:
        raise APIException({"detail": "Shipment does not belong to the selected sales order"})


def _ensure_wave_matches_sales_order(*, wave: OutboundWave, sales_order: SalesOrder) -> None:
    if wave.warehouse_id != sales_order.warehouse_id:
        raise APIException({"detail": "Wave warehouse must match the sales order warehouse"})
    if wave.order_type != sales_order.order_type:
        raise ValidationError({"detail": "Wave order type must match the sales order order type"})
    if not wave.orders.filter(sales_order=sales_order, is_delete=False).exists():
        raise APIException({"detail": "Sales order is not assigned to the selected wave"})


@transaction.atomic
def create_sales_order(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    customer: Customer,
    staging_location: Location,
    order_type: str,
    order_number: str,
    order_time,
    requested_ship_date,
    expires_at,
    reference_code: str,
    package_count: int,
    package_type: str,
    package_weight: Decimal,
    package_length: Decimal,
    package_width: Decimal,
    package_height: Decimal,
    package_volume: Decimal,
    logistics_provider: str,
    shipping_method: str,
    tracking_number: str,
    waybill_number: str,
    waybill_printed: bool,
    deliverer_name: str,
    deliverer_phone: str,
    receiver_name: str,
    receiver_phone: str,
    receiver_country: str,
    receiver_state: str,
    receiver_city: str,
    receiver_address: str,
    receiver_postal_code: str,
    packed_at,
    exception_state: str,
    exception_notes: str,
    notes: str,
    line_items: Iterable[SalesOrderLinePayload],
) -> SalesOrder:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(customer, openid, "Customer")
    _validate_staging_location(staging_location, openid=openid, warehouse=warehouse)
    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "Sales orders require at least one line item"})

    sales_order = SalesOrder.objects.create(
        warehouse=warehouse,
        customer=customer,
        staging_location=staging_location,
        order_type=order_type,
        order_number=order_number,
        order_time=order_time or timezone.now(),
        requested_ship_date=requested_ship_date,
        expires_at=expires_at,
        reference_code=reference_code,
        package_count=package_count,
        package_type=package_type,
        package_weight=package_weight,
        package_length=package_length,
        package_width=package_width,
        package_height=package_height,
        package_volume=package_volume,
        logistics_provider=logistics_provider,
        shipping_method=shipping_method,
        tracking_number=tracking_number,
        waybill_number=waybill_number,
        waybill_printed=waybill_printed,
        waybill_printed_at=timezone.now() if waybill_printed else None,
        deliverer_name=deliverer_name,
        deliverer_phone=deliverer_phone,
        receiver_name=receiver_name,
        receiver_phone=receiver_phone,
        receiver_country=receiver_country,
        receiver_state=receiver_state,
        receiver_city=receiver_city,
        receiver_address=receiver_address,
        receiver_postal_code=receiver_postal_code,
        packed_at=packed_at,
        exception_state=exception_state,
        exception_notes=exception_notes,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    used_line_numbers: set[int] = set()
    for payload in line_items:
        if payload.line_number in used_line_numbers:
            raise APIException({"detail": "Sales order line numbers must be unique"})
        used_line_numbers.add(payload.line_number)
        ensure_tenant_match(payload.goods, openid, "Goods")
        SalesOrderLine.objects.create(
            sales_order=sales_order,
            line_number=payload.line_number,
            goods=payload.goods,
            ordered_qty=payload.ordered_qty,
            unit_price=payload.unit_price,
            stock_status=payload.stock_status,
            creator=operator_name,
            openid=openid,
        )
    refresh_sales_order_status(sales_order)
    return sales_order


@transaction.atomic
def update_sales_order(
    *,
    openid: str,
    sales_order: SalesOrder,
    warehouse: Warehouse,
    customer: Customer,
    staging_location: Location,
    order_time,
    requested_ship_date,
    expires_at,
    reference_code: str,
    package_count: int,
    package_type: str,
    package_weight: Decimal,
    package_length: Decimal,
    package_width: Decimal,
    package_height: Decimal,
    package_volume: Decimal,
    logistics_provider: str,
    shipping_method: str,
    tracking_number: str,
    waybill_number: str,
    waybill_printed: bool,
    deliverer_name: str,
    deliverer_phone: str,
    receiver_name: str,
    receiver_phone: str,
    receiver_country: str,
    receiver_state: str,
    receiver_city: str,
    receiver_address: str,
    receiver_postal_code: str,
    packed_at,
    exception_state: str,
    exception_notes: str,
    notes: str,
    status: str,
) -> SalesOrder:
    ensure_tenant_match(sales_order, openid, "Sales order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(customer, openid, "Customer")
    _validate_staging_location(staging_location, openid=openid, warehouse=warehouse)

    has_work = PickTask.objects.filter(sales_order_line__sales_order=sales_order, is_delete=False).exists()
    has_shipments = sales_order.shipments.filter(is_delete=False).exists()
    if has_work or has_shipments:
        if warehouse.id != sales_order.warehouse_id or customer.id != sales_order.customer_id:
            raise APIException({"detail": "Warehouse and customer cannot change after outbound work exists"})
        if staging_location.id != sales_order.staging_location_id:
            raise APIException({"detail": "Staging location cannot change after pick tasks exist"})
    if packed_at is not None:
        active_lines = sales_order.lines.filter(is_delete=False).exclude(status=SalesOrderLineStatus.CANCELLED)
        if active_lines.exists() and not all(line.picked_qty + line.shipped_qty >= line.ordered_qty for line in active_lines):
            raise APIException({"detail": "Orders can only be marked packed after every active line is picked"})
    if status == SalesOrderStatus.CANCELLED:
        if has_work or has_shipments:
            raise APIException({"detail": "Sales orders with pick tasks or shipments cannot be cancelled"})
        sales_order.lines.filter(is_delete=False).update(status=SalesOrderLineStatus.CANCELLED, update_time=timezone.now())
        sales_order.status = SalesOrderStatus.CANCELLED
    else:
        sales_order.status = sales_order.status if sales_order.status in {SalesOrderStatus.SHIPPED, SalesOrderStatus.CANCELLED} else status

    sales_order.warehouse = warehouse
    sales_order.customer = customer
    sales_order.staging_location = staging_location
    sales_order.order_time = order_time
    sales_order.requested_ship_date = requested_ship_date
    sales_order.expires_at = expires_at
    sales_order.reference_code = reference_code
    sales_order.package_count = package_count
    sales_order.package_type = package_type
    sales_order.package_weight = package_weight
    sales_order.package_length = package_length
    sales_order.package_width = package_width
    sales_order.package_height = package_height
    sales_order.package_volume = package_volume
    sales_order.logistics_provider = logistics_provider
    sales_order.shipping_method = shipping_method
    sales_order.tracking_number = tracking_number
    sales_order.waybill_number = waybill_number
    sales_order.waybill_printed = waybill_printed
    sales_order.waybill_printed_at = (
        sales_order.waybill_printed_at or timezone.now()
        if waybill_printed
        else None
    )
    sales_order.deliverer_name = deliverer_name
    sales_order.deliverer_phone = deliverer_phone
    sales_order.receiver_name = receiver_name
    sales_order.receiver_phone = receiver_phone
    sales_order.receiver_country = receiver_country
    sales_order.receiver_state = receiver_state
    sales_order.receiver_city = receiver_city
    sales_order.receiver_address = receiver_address
    sales_order.receiver_postal_code = receiver_postal_code
    sales_order.packed_at = packed_at
    sales_order.exception_state = exception_state
    sales_order.exception_notes = exception_notes
    sales_order.notes = notes
    sales_order.save(
        update_fields=[
            "warehouse",
            "customer",
            "staging_location",
            "order_time",
            "requested_ship_date",
            "expires_at",
            "reference_code",
            "package_count",
            "package_type",
            "package_weight",
            "package_length",
            "package_width",
            "package_height",
            "package_volume",
            "logistics_provider",
            "shipping_method",
            "tracking_number",
            "waybill_number",
            "waybill_printed",
            "waybill_printed_at",
            "deliverer_name",
            "deliverer_phone",
            "receiver_name",
            "receiver_phone",
            "receiver_country",
            "receiver_state",
            "receiver_city",
            "receiver_address",
            "receiver_postal_code",
            "packed_at",
            "exception_state",
            "exception_notes",
            "notes",
            "status",
            "update_time",
        ]
    )
    if sales_order.status != SalesOrderStatus.CANCELLED:
        refresh_sales_order_status(sales_order)
    return sales_order


@transaction.atomic
def archive_sales_order(*, openid: str, sales_order: SalesOrder) -> SalesOrder:
    ensure_tenant_match(sales_order, openid, "Sales order")
    if PickTask.objects.filter(sales_order_line__sales_order=sales_order, is_delete=False).exists() or sales_order.shipments.filter(is_delete=False).exists():
        raise APIException({"detail": "Sales orders with outbound work cannot be archived"})
    sales_order.is_delete = True
    sales_order.save(update_fields=["is_delete", "update_time"])
    sales_order.lines.filter(is_delete=False).update(is_delete=True, update_time=timezone.now())
    return sales_order


@transaction.atomic
def allocate_sales_order(
    *,
    openid: str,
    operator_name: str,
    sales_order: SalesOrder,
    assigned_to: Staff | None,
) -> AllocationResult:
    ensure_tenant_match(sales_order, openid, "Sales order")
    if sales_order.status in {SalesOrderStatus.CANCELLED, SalesOrderStatus.SHIPPED}:
        raise APIException({"detail": "This sales order is no longer available for allocation"})
    if assigned_to is not None:
        ensure_tenant_match(assigned_to, openid, "Assigned staff")
        if assigned_to.is_lock:
            raise APIException({"detail": "Assigned operator is locked"})
    _validate_staging_location(sales_order.staging_location, openid=openid, warehouse=sales_order.warehouse)

    allocated_tasks = 0
    lines = list(sales_order.lines.select_for_update().select_related("goods").filter(is_delete=False))
    for line in lines:
        if line.status == SalesOrderLineStatus.CANCELLED:
            continue
        remaining_qty = line.ordered_qty - line.allocated_qty - line.picked_qty - line.shipped_qty
        if remaining_qty <= ZERO:
            continue
        balances = InventoryBalance.objects.select_for_update().select_related("location").filter(
            openid=openid,
            warehouse=sales_order.warehouse,
            goods=line.goods,
            stock_status=line.stock_status,
            is_delete=False,
            on_hand_qty__gt=F("allocated_qty") + F("hold_qty"),
            location__is_delete=False,
            location__is_locked=False,
            location__status=LocationStatus.AVAILABLE,
            location__location_type__picking_enabled=True,
        ).order_by("-location__is_pick_face", "location__pick_sequence", "location__location_code")
        existing_tasks = line.pick_tasks.filter(is_delete=False).count()
        for balance in balances:
            available_qty = balance.available_qty
            if available_qty <= ZERO:
                continue
            allocate_qty = remaining_qty if remaining_qty <= available_qty else available_qty
            balance.allocated_qty += allocate_qty
            validate_balance_quantities(balance)
            balance.save(update_fields=["allocated_qty", "update_time"])
            existing_tasks += 1
            task_status = PickTaskStatus.ASSIGNED if assigned_to is not None else PickTaskStatus.OPEN
            PickTask.objects.create(
                sales_order_line=line,
                warehouse=sales_order.warehouse,
                goods=line.goods,
                task_number=f"PICK-{sales_order.order_number}-{line.line_number:03d}-{existing_tasks:03d}",
                from_location=balance.location,
                to_location=sales_order.staging_location,
                quantity=allocate_qty,
                stock_status=line.stock_status,
                lot_number=balance.lot_number,
                serial_number=balance.serial_number,
                status=task_status,
                assigned_to=assigned_to,
                notes="Generated from sales order allocation.",
                creator=operator_name,
                openid=openid,
            )
            line.allocated_qty += allocate_qty
            remaining_qty -= allocate_qty
            allocated_tasks += 1
            if remaining_qty <= ZERO:
                break
        line.status = _line_status(line)
        line.save(update_fields=["allocated_qty", "status", "update_time"])

    if allocated_tasks == 0:
        raise APIException({"detail": "No available inventory was found to allocate"})
    refresh_sales_order_status(sales_order)
    return AllocationResult(sales_order=sales_order, allocated_tasks=allocated_tasks)


@transaction.atomic
def update_pick_task(*, openid: str, pick_task: PickTask, payload: PickTaskUpdatePayload) -> PickTask:
    ensure_tenant_match(pick_task, openid, "Pick task")
    if pick_task.status == PickTaskStatus.COMPLETED:
        raise APIException({"detail": "Completed pick tasks are immutable"})
    if payload.assigned_to is not None:
        ensure_tenant_match(payload.assigned_to, openid, "Assigned staff")
        if payload.assigned_to.is_lock:
            raise APIException({"detail": "Assigned operator is locked"})
    destination = payload.to_location or pick_task.to_location
    _validate_staging_location(destination, openid=openid, warehouse=pick_task.warehouse)
    if payload.status == PickTaskStatus.COMPLETED:
        raise APIException({"detail": "Use the complete endpoint to finish pick tasks"})
    if payload.status == PickTaskStatus.ASSIGNED and payload.assigned_to is None and pick_task.assigned_to is None:
        raise APIException({"detail": "Assigned pick tasks require an assignee"})

    pick_task.assigned_to = payload.assigned_to
    pick_task.to_location = destination
    pick_task.notes = payload.notes
    pick_task.status = payload.status
    pick_task.save(update_fields=["assigned_to", "to_location", "notes", "status", "update_time"])
    return pick_task


@transaction.atomic
def complete_pick_task(
    *,
    openid: str,
    operator_name: str,
    pick_task: PickTask,
    to_location: Location | None,
) -> PickTask:
    ensure_tenant_match(pick_task, openid, "Pick task")
    pick_task = PickTask.objects.select_for_update(of=("self",)).select_related(
        "sales_order_line",
        "sales_order_line__sales_order",
        "warehouse",
        "goods",
        "from_location",
        "to_location",
        "license_plate",
    ).get(pk=pick_task.pk)
    if pick_task.status == PickTaskStatus.COMPLETED:
        return pick_task
    if pick_task.status == PickTaskStatus.CANCELLED:
        raise APIException({"detail": "Cancelled pick tasks cannot be completed"})

    destination = to_location or pick_task.to_location
    _validate_staging_location(destination, openid=openid, warehouse=pick_task.warehouse)
    source_balance = InventoryBalance.objects.select_for_update().get(
        openid=openid,
        warehouse=pick_task.warehouse,
        location=pick_task.from_location,
        goods=pick_task.goods,
        stock_status=pick_task.stock_status,
        lot_number=pick_task.lot_number,
        serial_number=pick_task.serial_number,
        is_delete=False,
    )
    if source_balance.allocated_qty < pick_task.quantity:
        raise APIException({"detail": "Allocated quantity is lower than the pick task quantity"})
    source_balance.allocated_qty -= pick_task.quantity
    validate_balance_quantities(source_balance)
    source_balance.save(update_fields=["allocated_qty", "update_time"])

    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=pick_task.warehouse,
        goods=pick_task.goods,
        movement_type=MovementType.PICK,
        quantity=pick_task.quantity,
        stock_status=pick_task.stock_status,
        lot_number=pick_task.lot_number,
        serial_number=pick_task.serial_number,
        unit_cost=source_balance.unit_cost,
        from_location=pick_task.from_location,
        to_location=destination,
        reference_code=pick_task.task_number,
        reason="Outbound pick completion",
    )
    if pick_task.license_plate_id:
        transition_license_plate(
            openid=openid,
            license_plate=pick_task.license_plate,
            location=destination,
            status=LicensePlateStatus.STAGED,
            reference_code=pick_task.task_number,
            notes="Outbound pick completed from scan-first workflow",
        )
    line = pick_task.sales_order_line
    if line.allocated_qty < pick_task.quantity:
        raise APIException({"detail": "Sales order line allocated quantity is lower than the pick quantity"})
    line.allocated_qty -= pick_task.quantity
    line.picked_qty += pick_task.quantity
    line.status = _line_status(line)
    line.save(update_fields=["allocated_qty", "picked_qty", "status", "update_time"])

    pick_task.to_location = destination
    pick_task.status = PickTaskStatus.COMPLETED
    pick_task.completed_by = operator_name
    pick_task.completed_at = timezone.now()
    pick_task.inventory_movement = movement
    pick_task.save(
        update_fields=[
            "to_location",
            "status",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "update_time",
        ]
    )
    refresh_sales_order_status(line.sales_order)
    return pick_task


@transaction.atomic
def report_short_pick(
    *,
    openid: str,
    operator_name: str,
    pick_task: PickTask,
    payload: ShortPickReportPayload,
) -> ShortPickRecord:
    ensure_tenant_match(pick_task, openid, "Pick task")
    task = PickTask.objects.select_for_update(of=("self",)).select_related(
        "sales_order_line",
        "sales_order_line__sales_order",
        "warehouse",
        "goods",
        "from_location",
        "to_location",
        "license_plate",
    ).get(pk=pick_task.pk)
    if task.status == PickTaskStatus.CANCELLED:
        raise APIException({"detail": "Cancelled pick tasks cannot be short-picked"})
    if task.status == PickTaskStatus.COMPLETED:
        raise APIException({"detail": "Completed pick tasks cannot be short-picked again"})
    if task.short_pick_records.filter(is_delete=False, status=ShortPickStatus.OPEN).exists():
        raise APIException({"detail": "This pick task already has an open short-pick exception"})

    picked_qty = payload.picked_qty if payload.picked_qty is not None else task.quantity - payload.short_qty
    if picked_qty < ZERO:
        raise APIException({"detail": "Picked quantity cannot be negative"})
    if picked_qty + payload.short_qty != task.quantity:
        raise APIException({"detail": "Picked quantity plus short quantity must equal the task quantity"})
    if payload.short_qty <= ZERO:
        raise APIException({"detail": "Short quantity must be greater than zero"})
    if picked_qty >= task.quantity:
        raise APIException({"detail": "Use the complete endpoint when the full task quantity was picked"})
    if task.license_plate_id and picked_qty != ZERO:
        raise APIException({"detail": "LPN-based pick tasks must be completed in full or short-picked without a partial quantity"})

    destination = payload.to_location or task.to_location
    _validate_staging_location(destination, openid=openid, warehouse=task.warehouse)
    source_balance = InventoryBalance.objects.select_for_update().get(
        openid=openid,
        warehouse=task.warehouse,
        location=task.from_location,
        goods=task.goods,
        stock_status=task.stock_status,
        lot_number=task.lot_number,
        serial_number=task.serial_number,
        is_delete=False,
    )
    if source_balance.allocated_qty < task.quantity:
        raise APIException({"detail": "Allocated quantity is lower than the pick task quantity"})
    source_balance.allocated_qty -= task.quantity
    validate_balance_quantities(source_balance)
    source_balance.save(update_fields=["allocated_qty", "update_time"])

    if payload.short_qty > ZERO:
        create_inventory_hold(
            openid=openid,
            operator_name=operator_name,
            inventory_balance=source_balance,
            quantity=payload.short_qty,
            reason=f"SHORT_PICK:{payload.reason_code}",
            reference_code=task.task_number,
            notes=payload.notes or "Short pick requires follow-up",
        )

    movement = None
    if picked_qty > ZERO:
        movement = record_inventory_movement(
            openid=openid,
            operator_name=operator_name,
            warehouse=task.warehouse,
            goods=task.goods,
            movement_type=MovementType.PICK,
            quantity=picked_qty,
            stock_status=task.stock_status,
            lot_number=task.lot_number,
            serial_number=task.serial_number,
            unit_cost=source_balance.unit_cost,
            from_location=task.from_location,
            to_location=destination,
            reference_code=task.task_number,
            reason="Outbound short-pick completion",
        )

    line = task.sales_order_line
    if line.allocated_qty < task.quantity:
        raise APIException({"detail": "Sales order line allocated quantity is lower than the pick task quantity"})
    line.allocated_qty -= task.quantity
    line.picked_qty += picked_qty
    line.status = _line_status(line)
    line.save(update_fields=["allocated_qty", "picked_qty", "status", "update_time"])

    task.to_location = destination
    task.status = PickTaskStatus.COMPLETED
    task.completed_by = operator_name
    task.completed_at = timezone.now()
    task.inventory_movement = movement
    task.notes = payload.notes or task.notes
    task.save(
        update_fields=[
            "to_location",
            "status",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "notes",
            "update_time",
        ]
    )

    short_pick = ShortPickRecord.objects.create(
        warehouse=task.warehouse,
        sales_order=line.sales_order,
        sales_order_line=line,
        pick_task=task,
        goods=task.goods,
        from_location=task.from_location,
        to_location=destination,
        requested_qty=task.quantity,
        picked_qty=picked_qty,
        short_qty=payload.short_qty,
        stock_status=task.stock_status,
        lot_number=task.lot_number,
        serial_number=task.serial_number,
        reason_code=payload.reason_code,
        notes=payload.notes,
        reported_by=operator_name,
        creator=operator_name,
        openid=openid,
    )
    if line.sales_order.exception_state != SalesOrderExceptionState.ORDER_INTERCEPTION:
        line.sales_order.exception_state = SalesOrderExceptionState.ABNORMAL_PACKAGE
        line.sales_order.save(update_fields=["exception_state", "update_time"])
    refresh_sales_order_status(line.sales_order)
    return short_pick


@transaction.atomic
def resolve_short_pick_record(
    *,
    openid: str,
    operator_name: str,
    short_pick_record: ShortPickRecord,
    payload: ShortPickResolvePayload,
) -> ShortPickRecord:
    ensure_tenant_match(short_pick_record, openid, "Short-pick record")
    record = ShortPickRecord.objects.select_for_update().get(pk=short_pick_record.pk)
    if record.status == ShortPickStatus.RESOLVED:
        return record
    record.status = ShortPickStatus.RESOLVED
    record.resolved_by = operator_name
    record.resolved_at = timezone.now()
    record.resolution_notes = payload.resolution_notes
    record.save(update_fields=["status", "resolved_by", "resolved_at", "resolution_notes", "update_time"])
    if record.sales_order.exception_state == SalesOrderExceptionState.ABNORMAL_PACKAGE:
        remaining_open_short_picks = record.sales_order.short_pick_records.filter(
            is_delete=False,
            status=ShortPickStatus.OPEN,
        ).exclude(pk=record.pk)
        if not remaining_open_short_picks.exists():
            record.sales_order.exception_state = SalesOrderExceptionState.NORMAL
            record.sales_order.save(update_fields=["exception_state", "update_time"])
    refresh_sales_order_status(record.sales_order)
    return record


@transaction.atomic
def create_shipment(
    *,
    openid: str,
    operator_name: str,
    sales_order: SalesOrder,
    warehouse: Warehouse,
    staging_location: Location,
    shipment_number: str,
    reference_code: str,
    notes: str,
    line_items: Iterable[ShipmentLinePayload],
) -> Shipment:
    from reporting.billing_services import BillingChargePayload, record_charge_event
    from reporting.models import BillingChargeStatus, BillingChargeType

    ensure_tenant_match(sales_order, openid, "Sales order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    if warehouse.id != sales_order.warehouse_id:
        raise APIException({"detail": "Shipment warehouse must match the sales order warehouse"})
    if staging_location.id != sales_order.staging_location_id:
        raise APIException({"detail": "Shipment staging location must match the sales order staging location"})
    _validate_staging_location(staging_location, openid=openid, warehouse=warehouse)
    if sales_order.status == SalesOrderStatus.CANCELLED:
        raise APIException({"detail": "Cancelled sales orders cannot be shipped"})

    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "Shipments require at least one shipment line"})

    shipment = Shipment.objects.create(
        sales_order=sales_order,
        warehouse=warehouse,
        staging_location=staging_location,
        shipment_number=shipment_number,
        reference_code=reference_code,
        notes=notes,
        shipped_by=operator_name,
        creator=operator_name,
        openid=openid,
    )
    total_shipped_qty = ZERO
    for payload in line_items:
        line = SalesOrderLine.objects.select_for_update().select_related("goods", "sales_order").get(pk=payload.sales_order_line.pk)
        ensure_tenant_match(line, openid, "Sales order line")
        if line.sales_order_id != sales_order.id:
            raise APIException({"detail": "Shipment line does not belong to the selected sales order"})
        if payload.shipped_qty > line.picked_qty:
            raise APIException({"detail": "Shipped quantity cannot exceed the picked quantity awaiting shipment"})
        from_location = payload.from_location or staging_location
        _validate_staging_location(from_location, openid=openid, warehouse=warehouse)
        stage_balance = InventoryBalance.objects.select_for_update().get(
            openid=openid,
            warehouse=warehouse,
            location=from_location,
            goods=line.goods,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number,
            serial_number=payload.serial_number,
            is_delete=False,
        )
        movement = record_inventory_movement(
            openid=openid,
            operator_name=operator_name,
            warehouse=warehouse,
            goods=line.goods,
            movement_type=MovementType.SHIP,
            quantity=payload.shipped_qty,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number,
            serial_number=payload.serial_number,
            unit_cost=stage_balance.unit_cost,
            from_location=from_location,
            reference_code=shipment_number,
            reason="Outbound shipment posting",
        )
        ShipmentLine.objects.create(
            shipment=shipment,
            sales_order_line=line,
            goods=line.goods,
            from_location=from_location,
            shipped_qty=payload.shipped_qty,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number,
            serial_number=payload.serial_number,
            inventory_movement=movement,
            license_plate=payload.license_plate,
            creator=operator_name,
            openid=openid,
        )
        total_shipped_qty += payload.shipped_qty
        line.picked_qty -= payload.shipped_qty
        line.shipped_qty += payload.shipped_qty
        line.status = _line_status(line)
        line.save(update_fields=["picked_qty", "shipped_qty", "status", "update_time"])

    refresh_sales_order_status(sales_order)
    record_charge_event(
        openid=openid,
        operator_name=operator_name,
        payload=BillingChargePayload(
            warehouse=warehouse,
            customer=sales_order.customer,
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            event_date=shipment.shipped_at.date(),
            quantity=total_shipped_qty,
            uom="EA",
            unit_rate=ZERO,
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="operations.outbound",
            source_record_type="Shipment",
            source_record_id=shipment.id,
            reference_code=shipment.shipment_number,
            notes="Operational shipment event captured for 3PL billing review",
        ),
    )
    return shipment


@transaction.atomic
def create_outbound_wave(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    wave_number: str,
    sales_orders: Iterable[SalesOrder],
    notes: str,
) -> OutboundWave:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    sales_orders = list(sales_orders)
    if not sales_orders:
        raise APIException({"detail": "Waves require at least one sales order"})
    wave_order_type = sales_orders[0].order_type

    wave = OutboundWave.objects.create(
        warehouse=warehouse,
        order_type=wave_order_type,
        wave_number=wave_number,
        status=OutboundWaveStatus.OPEN,
        notes=notes,
        generated_by=operator_name,
        creator=operator_name,
        openid=openid,
    )

    seen_ids: set[int] = set()
    for index, sales_order in enumerate(sales_orders, start=1):
        ensure_tenant_match(sales_order, openid, "Sales order")
        if sales_order.id in seen_ids:
            raise APIException({"detail": "Wave sales orders must be unique"})
        seen_ids.add(sales_order.id)
        if sales_order.warehouse_id != warehouse.id:
            raise APIException({"detail": "Wave sales orders must belong to the selected warehouse"})
        if sales_order.order_type != wave_order_type:
            raise ValidationError({"detail": "Waves cannot mix sales order types"})
        if sales_order.status in {SalesOrderStatus.CANCELLED, SalesOrderStatus.SHIPPED}:
            raise APIException({"detail": "Cancelled or shipped sales orders cannot be added to a wave"})
        existing_active_wave = sales_order.wave_assignments.filter(
            is_delete=False,
            wave__is_delete=False,
        ).exclude(wave__status=OutboundWaveStatus.CANCELLED)
        if existing_active_wave.exists():
            raise APIException({"detail": f"Sales order {sales_order.order_number} is already assigned to an active wave"})

        OutboundWaveOrder.objects.create(
            wave=wave,
            sales_order=sales_order,
            sort_sequence=index,
            creator=operator_name,
            openid=openid,
        )
    return wave


@transaction.atomic
def update_outbound_wave(*, openid: str, wave: OutboundWave, payload: WaveUpdatePayload) -> OutboundWave:
    ensure_tenant_match(wave, openid, "Outbound wave")
    wave.status = payload.status
    wave.notes = payload.notes
    wave.save(update_fields=["status", "notes", "update_time"])
    return wave


@transaction.atomic
def record_package_execution(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    sales_order: SalesOrder,
    payload: PackageExecutionPayload,
) -> PackageExecutionRecord:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(sales_order, openid, "Sales order")
    if sales_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Package execution warehouse must match the sales order warehouse"})
    if payload.requested_order_type and sales_order.order_type != payload.requested_order_type:
        raise ValidationError({"detail": f"Sales order does not belong to the {payload.requested_order_type} partition"})
    if payload.step_type == PackageExecutionStep.WEIGH and payload.weight is None:
        raise APIException({"detail": "Weight is required for weighing records"})
    if payload.shipment is not None:
        ensure_tenant_match(payload.shipment, openid, "Shipment")
        _ensure_shipment_matches_sales_order(shipment=payload.shipment, sales_order=sales_order)
        if payload.shipment.warehouse_id != warehouse.id:
            raise APIException({"detail": "Shipment warehouse must match the selected warehouse"})
    if payload.wave is not None:
        ensure_tenant_match(payload.wave, openid, "Wave")
        _ensure_wave_matches_sales_order(wave=payload.wave, sales_order=sales_order)

    record = PackageExecutionRecord.objects.create(
        warehouse=warehouse,
        sales_order=sales_order,
        shipment=payload.shipment,
        wave=payload.wave,
        record_number=payload.record_number,
        step_type=payload.step_type,
        execution_status=payload.execution_status,
        package_number=payload.package_number,
        scan_code=payload.scan_code,
        weight=payload.weight,
        notes=payload.notes,
        executed_by=operator_name,
        creator=operator_name,
        openid=openid,
    )

    update_fields: list[str] = []
    if payload.weight is not None and sales_order.package_weight != payload.weight:
        sales_order.package_weight = payload.weight
        update_fields.append("package_weight")
    if payload.step_type in {PackageExecutionStep.PACK, PackageExecutionStep.WEIGH} and sales_order.packed_at is None:
        sales_order.packed_at = record.executed_at
        update_fields.append("packed_at")
    if payload.execution_status == PackageExecutionStatus.FLAGGED and sales_order.exception_state != SalesOrderExceptionState.ORDER_INTERCEPTION:
        sales_order.exception_state = SalesOrderExceptionState.ABNORMAL_PACKAGE
        update_fields.append("exception_state")
        if payload.notes:
            sales_order.exception_notes = payload.notes
            update_fields.append("exception_notes")
    if update_fields:
        sales_order.save(update_fields=[*update_fields, "update_time"])
    refresh_sales_order_status(sales_order)
    return record


@transaction.atomic
def create_shipment_document(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    sales_order: SalesOrder,
    payload: ShipmentDocumentPayload,
) -> ShipmentDocumentRecord:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(sales_order, openid, "Sales order")
    if sales_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Document warehouse must match the sales order warehouse"})
    if payload.shipment is not None:
        ensure_tenant_match(payload.shipment, openid, "Shipment")
        _ensure_shipment_matches_sales_order(shipment=payload.shipment, sales_order=sales_order)
    if payload.wave is not None:
        ensure_tenant_match(payload.wave, openid, "Wave")
        _ensure_wave_matches_sales_order(wave=payload.wave, sales_order=sales_order)

    document = ShipmentDocumentRecord.objects.create(
        warehouse=warehouse,
        sales_order=sales_order,
        shipment=payload.shipment,
        wave=payload.wave,
        document_number=payload.document_number,
        document_type=payload.document_type,
        reference_code=payload.reference_code,
        file_name=payload.file_name,
        notes=payload.notes,
        generated_by=operator_name,
        creator=operator_name,
        openid=openid,
    )

    if payload.document_type == ShipmentDocumentType.SCANFORM:
        sales_order.waybill_printed = True
        sales_order.waybill_printed_at = sales_order.waybill_printed_at or document.generated_at
        sales_order.save(update_fields=["waybill_printed", "waybill_printed_at", "update_time"])
        refresh_sales_order_status(sales_order)
    return document


@transaction.atomic
def record_logistics_tracking_event(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    sales_order: SalesOrder,
    payload: LogisticsTrackingPayload,
) -> LogisticsTrackingEvent:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(sales_order, openid, "Sales order")
    if sales_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Tracking warehouse must match the sales order warehouse"})
    if payload.shipment is not None:
        ensure_tenant_match(payload.shipment, openid, "Shipment")
        _ensure_shipment_matches_sales_order(shipment=payload.shipment, sales_order=sales_order)

    tracking_number = payload.tracking_number or sales_order.tracking_number
    if not tracking_number:
        raise APIException({"detail": "Tracking number is required for logistics tracking"})

    event = LogisticsTrackingEvent.objects.create(
        warehouse=warehouse,
        sales_order=sales_order,
        shipment=payload.shipment,
        event_number=payload.event_number,
        tracking_number=tracking_number,
        event_code=payload.event_code,
        event_status=payload.event_status,
        event_location=payload.event_location,
        description=payload.description,
        occurred_at=payload.occurred_at or timezone.now(),
        recorded_by=operator_name,
        creator=operator_name,
        openid=openid,
    )

    update_fields: list[str] = []
    if sales_order.tracking_number != tracking_number:
        sales_order.tracking_number = tracking_number
        update_fields.append("tracking_number")
    if payload.event_status == LogisticsTrackingStatus.EXCEPTION and sales_order.exception_state != SalesOrderExceptionState.ORDER_INTERCEPTION:
        sales_order.exception_state = SalesOrderExceptionState.ABNORMAL_PACKAGE
        update_fields.append("exception_state")
        if payload.description:
            sales_order.exception_notes = payload.description
            update_fields.append("exception_notes")
    if update_fields:
        sales_order.save(update_fields=[*update_fields, "update_time"])
    return event


def _record_dock_load_verification(
    *,
    openid: str,
    operator_name: str,
    shipment: Shipment,
    shipment_line: ShipmentLine,
    dock_location: Location,
    trailer_reference: str,
    notes: str,
) -> DockLoadVerification:
    return DockLoadVerification.objects.create(
        shipment=shipment,
        shipment_line=shipment_line,
        warehouse=shipment.warehouse,
        dock_location=dock_location,
        goods=shipment_line.goods,
        license_plate=shipment_line.license_plate,
        verified_qty=shipment_line.shipped_qty,
        status=DockLoadVerificationStatus.VERIFIED,
        trailer_reference=trailer_reference,
        verified_by=operator_name,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def scan_complete_pick_task(*, openid: str, operator: Staff, payload: ScanPickPayload) -> PickTask:
    ensure_tenant_match(operator, openid, "Operator")
    task = PickTask.objects.select_for_update(of=("self",)).select_related("warehouse", "from_location", "goods", "assigned_to", "license_plate").get(
        openid=openid,
        task_number=payload.task_number,
        is_delete=False,
    )
    _ensure_task_operator(task=task, operator=operator)

    from_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=task.warehouse,
        scan_code=payload.from_location_barcode,
    )
    if from_location.id != task.from_location_id:
        raise APIException({"detail": "Scanned source location does not match the pick task"})
    goods = resolve_goods_by_scan_code(openid=openid, scan_code=payload.goods_barcode)
    if goods.id != task.goods_id:
        raise APIException({"detail": "Scanned goods do not match the pick task"})
    if payload.lpn_barcode:
        license_plate = resolve_license_plate_by_scan_code(
            openid=openid,
            warehouse=task.warehouse,
            scan_code=payload.lpn_barcode,
        )
        if task.license_plate_id and task.license_plate_id != license_plate.id:
            raise APIException({"detail": "Scanned LPN does not match the pick task"})
        if license_plate.goods_id != task.goods_id or license_plate.current_location_id != task.from_location_id:
            raise APIException({"detail": "Scanned LPN is not staged at the pick source for this task"})
        if license_plate.lot_number and license_plate.lot_number != task.lot_number:
            raise APIException({"detail": "Scanned LPN lot does not match the pick task lot"})
        if license_plate.serial_number and license_plate.serial_number != task.serial_number:
            raise APIException({"detail": "Scanned LPN serial does not match the pick task serial"})
        if task.license_plate_id is None:
            task.license_plate = license_plate
            task.save(update_fields=["license_plate", "update_time"])
    to_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=task.warehouse,
        scan_code=payload.to_location_barcode,
    )
    return complete_pick_task(
        openid=openid,
        operator_name=operator.staff_name,
        pick_task=task,
        to_location=to_location,
    )


@transaction.atomic
def scan_ship_sales_order(*, openid: str, operator: Staff, warehouse: Warehouse, payload: ScanShipmentPayload) -> Shipment:
    from reporting.billing_services import BillingChargePayload, upsert_charge_event
    from reporting.models import BillingChargeStatus, BillingChargeType

    ensure_tenant_match(operator, openid, "Operator")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})

    sales_order = SalesOrder.objects.select_for_update().select_related("warehouse", "customer", "staging_location").get(
        openid=openid,
        order_number=payload.sales_order_number,
        is_delete=False,
    )
    if sales_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Scanned sales order does not belong to the selected warehouse"})
    if sales_order.status == SalesOrderStatus.CANCELLED:
        raise APIException({"detail": "Cancelled sales orders cannot be shipped"})

    staging_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=warehouse,
        scan_code=payload.staging_location_barcode,
    )
    if staging_location.id != sales_order.staging_location_id:
        raise APIException({"detail": "Scanned staging location does not match the sales order"})
    _validate_staging_location(staging_location, openid=openid, warehouse=warehouse)

    goods = resolve_goods_by_scan_code(openid=openid, scan_code=payload.goods_barcode)
    lot_number, serial_number = resolve_and_validate_scan_attributes(
        openid=openid,
        goods=goods,
        lot_number=payload.lot_number,
        serial_number=payload.serial_number,
        attribute_scan=payload.attribute_scan,
    )
    license_plate = None
    if payload.lpn_barcode:
        license_plate = resolve_license_plate_by_scan_code(
            openid=openid,
            warehouse=warehouse,
            scan_code=payload.lpn_barcode,
        )
        if license_plate.goods_id != goods.id or license_plate.current_location_id != staging_location.id:
            raise APIException({"detail": "Scanned LPN is not currently staged for this shipment"})
        if payload.shipped_qty > license_plate.quantity:
            raise APIException({"detail": "Scanned quantity cannot exceed the quantity on the LPN"})
        if payload.shipped_qty != license_plate.quantity:
            raise APIException({"detail": "LPN-based shipping requires the scanned quantity to equal the LPN quantity"})
    line = (
        sales_order.lines.select_for_update()
        .filter(
            goods=goods,
            is_delete=False,
            status__in=[
                SalesOrderLineStatus.ALLOCATED,
                SalesOrderLineStatus.PARTIAL,
                SalesOrderLineStatus.PICKED,
            ],
            picked_qty__gte=payload.shipped_qty,
        )
        .order_by("line_number", "id")
        .first()
    )
    if line is None:
        raise APIException({"detail": "No picked sales order line matched the scanned goods"})

    shipment, created = Shipment.objects.select_for_update().get_or_create(
        openid=openid,
        shipment_number=payload.shipment_number,
        is_delete=False,
        defaults={
            "sales_order": sales_order,
            "warehouse": warehouse,
            "staging_location": staging_location,
            "reference_code": payload.reference_code,
            "notes": payload.notes,
            "shipped_by": operator.staff_name,
            "creator": operator.staff_name,
        },
    )
    if not created:
        if shipment.sales_order_id != sales_order.id or shipment.warehouse_id != warehouse.id:
            raise APIException({"detail": "Existing shipment number belongs to a different sales order or warehouse"})
        if shipment.staging_location_id != staging_location.id:
            raise APIException({"detail": "Scanned staging location must match the existing shipment header"})

    stage_balance = _resolve_staging_balance_for_scan(
        openid=openid,
        warehouse=warehouse,
        location=staging_location,
        goods=line.goods,
        stock_status=payload.stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
    )
    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator.staff_name,
        warehouse=warehouse,
        goods=line.goods,
        movement_type=MovementType.SHIP,
        quantity=payload.shipped_qty,
        stock_status=payload.stock_status,
        lot_number=stage_balance.lot_number,
        serial_number=stage_balance.serial_number,
        unit_cost=stage_balance.unit_cost,
        from_location=staging_location,
        reference_code=shipment.shipment_number,
        reason="Outbound shipment scan confirmation",
    )
    shipment_line = ShipmentLine.objects.create(
        shipment=shipment,
        sales_order_line=line,
        goods=line.goods,
        from_location=staging_location,
        shipped_qty=payload.shipped_qty,
        stock_status=payload.stock_status,
        lot_number=stage_balance.lot_number,
        serial_number=stage_balance.serial_number,
        inventory_movement=movement,
        license_plate=license_plate,
        creator=operator.staff_name,
        openid=openid,
    )
    if license_plate is not None:
        dock_location = (
            resolve_location_by_scan_code(
                openid=openid,
                warehouse=warehouse,
                scan_code=payload.dock_location_barcode,
            )
            if payload.dock_location_barcode
            else staging_location
        )
        transition_license_plate(
            openid=openid,
            license_plate=license_plate,
            location=dock_location,
            status=LicensePlateStatus.LOADED,
            reference_code=shipment.shipment_number,
            notes=payload.notes or "Dock load verified from scan-first shipment flow",
        )
    dock_location = None
    if payload.dock_location_barcode:
        dock_location = resolve_location_by_scan_code(
            openid=openid,
            warehouse=warehouse,
            scan_code=payload.dock_location_barcode,
        )
        _validate_staging_location(dock_location, openid=openid, warehouse=warehouse)
        _record_dock_load_verification(
            openid=openid,
            operator_name=operator.staff_name,
            shipment=shipment,
            shipment_line=shipment_line,
            dock_location=dock_location,
            trailer_reference=payload.trailer_reference,
            notes=payload.notes or "Dock load verified during shipment scan",
        )
    line.picked_qty -= payload.shipped_qty
    line.shipped_qty += payload.shipped_qty
    line.status = _line_status(line)
    line.save(update_fields=["picked_qty", "shipped_qty", "status", "update_time"])
    refresh_sales_order_status(sales_order)

    total_shipped_qty = sum((shipment_line.shipped_qty for shipment_line in shipment.lines.filter(is_delete=False)), ZERO)
    upsert_charge_event(
        openid=openid,
        operator_name=operator.staff_name,
        payload=BillingChargePayload(
            warehouse=warehouse,
            customer=sales_order.customer,
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            event_date=shipment.shipped_at.date(),
            quantity=total_shipped_qty,
            uom="EA",
            unit_rate=ZERO,
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="operations.outbound",
            source_record_type="Shipment",
            source_record_id=shipment.id,
            reference_code=shipment.shipment_number,
            notes="Operational shipment event captured from scan-first execution",
        ),
    )
    return shipment
