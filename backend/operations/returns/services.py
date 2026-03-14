"""Domain services for customer return receipt and disposition workflows."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Iterable

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from customer.models import ListModel as Customer
from inventory.models import MovementType
from inventory.services import ensure_location_usable, ensure_tenant_match, record_inventory_movement
from locations.models import Location, ZoneUsage
from warehouse.models import Warehouse

from .models import (
    ReturnDisposition,
    ReturnDispositionType,
    ReturnLine,
    ReturnLineStatus,
    ReturnOrder,
    ReturnOrderStatus,
    ReturnReceipt,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class ReturnLinePayload:
    line_number: int
    goods: object
    expected_qty: Decimal
    return_reason: str = ""
    notes: str = ""


@dataclass(frozen=True)
class ReturnOrderUpdatePayload:
    warehouse: Warehouse
    customer: Customer
    sales_order: object | None
    requested_date: object
    reference_code: str
    notes: str
    status: str


@dataclass(frozen=True)
class ReturnReceiptPayload:
    return_line: ReturnLine
    warehouse: Warehouse
    receipt_location: Location
    receipt_number: str
    received_qty: Decimal
    stock_status: str
    lot_number: str
    serial_number: str
    notes: str


@dataclass(frozen=True)
class ReturnDispositionPayload:
    return_receipt: ReturnReceipt
    warehouse: Warehouse
    disposition_number: str
    disposition_type: str
    quantity: Decimal
    to_location: Location | None
    notes: str


def _refresh_return_line_status(return_line: ReturnLine) -> ReturnLine:
    if return_line.status == ReturnLineStatus.CANCELLED:
        return return_line
    if return_line.disposed_qty >= return_line.received_qty and return_line.received_qty > ZERO:
        return_line.status = ReturnLineStatus.COMPLETED
    elif return_line.received_qty == ZERO:
        return_line.status = ReturnLineStatus.OPEN
    elif return_line.disposed_qty > ZERO:
        return_line.status = ReturnLineStatus.PARTIAL_DISPOSED
    elif return_line.received_qty >= return_line.expected_qty:
        return_line.status = ReturnLineStatus.RECEIVED
    else:
        return_line.status = ReturnLineStatus.PARTIAL_RECEIVED
    return_line.save(update_fields=["status", "update_time"])
    return return_line


def refresh_return_order_status(return_order: ReturnOrder) -> ReturnOrder:
    lines = list(return_order.lines.filter(is_delete=False))
    active_lines = [line for line in lines if line.status != ReturnLineStatus.CANCELLED]
    if not active_lines:
        return_order.status = ReturnOrderStatus.CANCELLED if lines else ReturnOrderStatus.OPEN
    elif all(line.status == ReturnLineStatus.COMPLETED for line in active_lines):
        return_order.status = ReturnOrderStatus.COMPLETED
    elif any(line.disposed_qty > ZERO for line in active_lines):
        return_order.status = ReturnOrderStatus.PARTIAL_DISPOSED
    elif all(line.received_qty >= line.expected_qty for line in active_lines):
        return_order.status = ReturnOrderStatus.RECEIVED
    elif any(line.received_qty > ZERO for line in active_lines):
        return_order.status = ReturnOrderStatus.PARTIAL_RECEIVED
    else:
        return_order.status = ReturnOrderStatus.OPEN
    return_order.save(update_fields=["status", "update_time"])
    return return_order


def _validate_sales_order_link(*, sales_order, warehouse: Warehouse, customer: Customer, openid: str) -> None:
    if sales_order is None:
        return
    ensure_tenant_match(sales_order, openid, "Sales order")
    if sales_order.warehouse_id != warehouse.id:
        raise ValidationError({"detail": "Sales order warehouse must match the selected return warehouse"})
    if sales_order.customer_id != customer.id:
        raise ValidationError({"detail": "Sales order customer must match the selected return customer"})


def _validate_receipt_location(*, location: Location, warehouse: Warehouse, openid: str) -> None:
    ensure_tenant_match(location, openid, "Receipt location")
    if location.warehouse_id != warehouse.id:
        raise ValidationError({"detail": "Receipt location must belong to the selected warehouse"})
    ensure_location_usable(location)
    if location.zone.usage not in {ZoneUsage.RETURNS, ZoneUsage.QUARANTINE}:
        raise ValidationError({"detail": "Return receipts must post into a returns or quarantine zone"})


def _validate_disposition_location(*, disposition_type: str, receipt: ReturnReceipt, to_location: Location | None, openid: str) -> None:
    if disposition_type == ReturnDispositionType.SCRAP:
        if to_location is not None:
            raise ValidationError({"detail": "Scrap dispositions must not define a destination location"})
        return
    if to_location is None:
        raise ValidationError({"detail": "A destination location is required for this disposition"})
    ensure_tenant_match(to_location, openid, "Disposition location")
    if to_location.warehouse_id != receipt.warehouse_id:
        raise ValidationError({"detail": "Disposition location must belong to the receipt warehouse"})
    ensure_location_usable(to_location)
    if disposition_type == ReturnDispositionType.RESTOCK:
        if receipt.stock_status != "AVAILABLE":
            raise ValidationError({"detail": "Only AVAILABLE return receipts may be restocked"})
        if to_location.zone.usage not in {ZoneUsage.STORAGE, ZoneUsage.PICKING}:
            raise ValidationError({"detail": "Restock dispositions must target a storage or picking zone"})
    elif disposition_type == ReturnDispositionType.QUARANTINE:
        if receipt.stock_status not in {"QUARANTINE", "DAMAGED"}:
            raise ValidationError({"detail": "Only QUARANTINE or DAMAGED receipts may move into quarantine"})
        if to_location.zone.usage not in {ZoneUsage.QUARANTINE, ZoneUsage.RETURNS}:
            raise ValidationError({"detail": "Quarantine dispositions must target a quarantine or returns zone"})


@transaction.atomic
def create_return_order(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    customer: Customer,
    sales_order,
    return_number: str,
    requested_date,
    reference_code: str,
    notes: str,
    line_items: Iterable[ReturnLinePayload],
) -> ReturnOrder:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(customer, openid, "Customer")
    _validate_sales_order_link(sales_order=sales_order, warehouse=warehouse, customer=customer, openid=openid)
    line_items = list(line_items)
    if not line_items:
        raise ValidationError({"detail": "Return orders require at least one line item"})

    return_order = ReturnOrder.objects.create(
        warehouse=warehouse,
        customer=customer,
        sales_order=sales_order,
        return_number=return_number,
        requested_date=requested_date,
        reference_code=reference_code,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    used_line_numbers: set[int] = set()
    for payload in line_items:
        if payload.line_number in used_line_numbers:
            raise ValidationError({"detail": "Return order line numbers must be unique"})
        used_line_numbers.add(payload.line_number)
        ensure_tenant_match(payload.goods, openid, "Goods")
        ReturnLine.objects.create(
            return_order=return_order,
            line_number=payload.line_number,
            goods=payload.goods,
            expected_qty=payload.expected_qty,
            return_reason=payload.return_reason,
            notes=payload.notes,
            creator=operator_name,
            openid=openid,
        )
    return return_order


@transaction.atomic
def update_return_order(
    *,
    openid: str,
    return_order: ReturnOrder,
    payload: ReturnOrderUpdatePayload,
) -> ReturnOrder:
    ensure_tenant_match(return_order, openid, "Return order")
    return_order = ReturnOrder.objects.select_for_update().select_related("warehouse", "customer", "sales_order").get(pk=return_order.pk)
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    ensure_tenant_match(payload.customer, openid, "Customer")
    _validate_sales_order_link(
        sales_order=payload.sales_order,
        warehouse=payload.warehouse,
        customer=payload.customer,
        openid=openid,
    )
    has_receipts = ReturnReceipt.objects.filter(return_line__return_order=return_order, is_delete=False).exists()
    has_dispositions = ReturnDisposition.objects.filter(return_receipt__return_line__return_order=return_order, is_delete=False).exists()
    if has_receipts or has_dispositions:
        if payload.warehouse.id != return_order.warehouse_id or payload.customer.id != return_order.customer_id:
            raise ValidationError({"detail": "Warehouse and customer cannot change after return work exists"})
        if (payload.sales_order is None) != (return_order.sales_order_id is None) or (
            payload.sales_order is not None and payload.sales_order.id != return_order.sales_order_id
        ):
            raise ValidationError({"detail": "Sales order cannot change after return work exists"})
    if payload.status == ReturnOrderStatus.CANCELLED:
        if has_receipts or has_dispositions:
            raise ValidationError({"detail": "Return orders with receipt or disposition work cannot be cancelled"})
        return_order.lines.filter(is_delete=False).update(status=ReturnLineStatus.CANCELLED, update_time=timezone.now())
        return_order.status = ReturnOrderStatus.CANCELLED
    else:
        return_order.status = return_order.status if return_order.status in {ReturnOrderStatus.COMPLETED, ReturnOrderStatus.CANCELLED} else payload.status
    return_order.warehouse = payload.warehouse
    return_order.customer = payload.customer
    return_order.sales_order = payload.sales_order
    return_order.requested_date = payload.requested_date
    return_order.reference_code = payload.reference_code
    return_order.notes = payload.notes
    return_order.save(
        update_fields=[
            "warehouse",
            "customer",
            "sales_order",
            "requested_date",
            "reference_code",
            "notes",
            "status",
            "update_time",
        ]
    )
    if return_order.status != ReturnOrderStatus.CANCELLED:
        refresh_return_order_status(return_order)
    return return_order


@transaction.atomic
def archive_return_order(*, openid: str, return_order: ReturnOrder) -> ReturnOrder:
    ensure_tenant_match(return_order, openid, "Return order")
    if ReturnReceipt.objects.filter(return_line__return_order=return_order, is_delete=False).exists() or ReturnDisposition.objects.filter(
        return_receipt__return_line__return_order=return_order,
        is_delete=False,
    ).exists():
        raise ValidationError({"detail": "Return orders with operational work cannot be archived"})
    return_order.is_delete = True
    return_order.save(update_fields=["is_delete", "update_time"])
    return_order.lines.filter(is_delete=False).update(is_delete=True, update_time=timezone.now())
    return return_order


@transaction.atomic
def record_return_receipt(
    *,
    openid: str,
    operator_name: str,
    payload: ReturnReceiptPayload,
) -> ReturnReceipt:
    from reporting.billing_services import BillingChargePayload, record_charge_event
    from reporting.models import BillingChargeStatus, BillingChargeType

    ensure_tenant_match(payload.return_line, openid, "Return line")
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    return_line = (
        ReturnLine.objects.select_for_update()
        .select_related("return_order", "return_order__warehouse", "goods")
        .get(pk=payload.return_line.pk)
    )
    if return_line.status == ReturnLineStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled return lines cannot receive stock"})
    if return_line.return_order.status == ReturnOrderStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled return orders cannot receive stock"})
    if payload.warehouse.id != return_line.return_order.warehouse_id:
        raise ValidationError({"detail": "Receipt warehouse must match the return order warehouse"})
    _validate_receipt_location(location=payload.receipt_location, warehouse=payload.warehouse, openid=openid)
    remaining_qty = return_line.expected_qty - return_line.received_qty
    if payload.received_qty > remaining_qty:
        raise ValidationError({"detail": "Received qty cannot exceed the remaining expected return qty"})

    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=payload.warehouse,
        goods=return_line.goods,
        movement_type=MovementType.RECEIPT,
        quantity=payload.received_qty,
        stock_status=payload.stock_status,
        lot_number=payload.lot_number,
        serial_number=payload.serial_number,
        unit_cost=Decimal("0.0000"),
        to_location=payload.receipt_location,
        reference_code=payload.receipt_number,
        reason=(payload.notes or return_line.return_reason or return_line.return_order.return_number)[:255],
    )
    receipt = ReturnReceipt.objects.create(
        return_line=return_line,
        warehouse=payload.warehouse,
        receipt_location=payload.receipt_location,
        receipt_number=payload.receipt_number,
        received_qty=payload.received_qty,
        stock_status=payload.stock_status,
        lot_number=payload.lot_number,
        serial_number=payload.serial_number,
        notes=payload.notes,
        received_by=operator_name,
        inventory_movement=movement,
        creator=operator_name,
        openid=openid,
    )
    return_line.received_qty += payload.received_qty
    return_line.save(update_fields=["received_qty", "update_time"])
    _refresh_return_line_status(return_line)
    refresh_return_order_status(return_line.return_order)
    record_charge_event(
        openid=openid,
        operator_name=operator_name,
        payload=BillingChargePayload(
            warehouse=payload.warehouse,
            customer=return_line.return_order.customer,
            charge_type=BillingChargeType.RETURN_HANDLING,
            event_date=receipt.received_at.date(),
            quantity=payload.received_qty,
            uom="EA",
            unit_rate=ZERO,
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="operations.returns",
            source_record_type="ReturnReceipt",
            source_record_id=receipt.id,
            reference_code=receipt.receipt_number,
            notes="Operational return receipt captured for 3PL billing review",
        ),
    )
    return receipt


@transaction.atomic
def record_return_disposition(
    *,
    openid: str,
    operator_name: str,
    payload: ReturnDispositionPayload,
) -> ReturnDisposition:
    ensure_tenant_match(payload.return_receipt, openid, "Return receipt")
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    receipt = (
        ReturnReceipt.objects.select_for_update()
        .select_related(
            "return_line",
            "return_line__return_order",
            "return_line__goods",
            "warehouse",
            "receipt_location",
        )
        .get(pk=payload.return_receipt.pk)
    )
    if payload.warehouse.id != receipt.warehouse_id:
        raise ValidationError({"detail": "Disposition warehouse must match the return receipt warehouse"})
    _validate_disposition_location(
        disposition_type=payload.disposition_type,
        receipt=receipt,
        to_location=payload.to_location,
        openid=openid,
    )
    disposed_qty = sum((item.quantity for item in receipt.dispositions.filter(is_delete=False)), ZERO)
    remaining_qty = receipt.received_qty - disposed_qty
    if payload.quantity > remaining_qty:
        raise ValidationError({"detail": "Disposition qty cannot exceed the undisposed receipt qty"})

    if payload.disposition_type == ReturnDispositionType.SCRAP:
        movement = record_inventory_movement(
            openid=openid,
            operator_name=operator_name,
            warehouse=payload.warehouse,
            goods=receipt.return_line.goods,
            movement_type=MovementType.ADJUSTMENT_OUT,
            quantity=payload.quantity,
            stock_status=receipt.stock_status,
            lot_number=receipt.lot_number,
            serial_number=receipt.serial_number,
            unit_cost=Decimal("0.0000"),
            from_location=receipt.receipt_location,
            reference_code=payload.disposition_number,
            reason=(payload.notes or payload.disposition_type)[:255],
        )
    else:
        movement = record_inventory_movement(
            openid=openid,
            operator_name=operator_name,
            warehouse=payload.warehouse,
            goods=receipt.return_line.goods,
            movement_type=MovementType.TRANSFER,
            quantity=payload.quantity,
            stock_status=receipt.stock_status,
            lot_number=receipt.lot_number,
            serial_number=receipt.serial_number,
            unit_cost=Decimal("0.0000"),
            from_location=receipt.receipt_location,
            to_location=payload.to_location,
            reference_code=payload.disposition_number,
            reason=(payload.notes or payload.disposition_type)[:255],
        )
    disposition = ReturnDisposition.objects.create(
        return_receipt=receipt,
        warehouse=payload.warehouse,
        disposition_number=payload.disposition_number,
        disposition_type=payload.disposition_type,
        quantity=payload.quantity,
        to_location=payload.to_location,
        notes=payload.notes,
        completed_by=operator_name,
        inventory_movement=movement,
        creator=operator_name,
        openid=openid,
    )
    return_line = receipt.return_line
    return_line.disposed_qty += payload.quantity
    return_line.save(update_fields=["disposed_qty", "update_time"])
    _refresh_return_line_status(return_line)
    refresh_return_order_status(return_line.return_order)
    return disposition
