from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.inventory.models import InventoryStatus, MovementType
from apps.inventory.services.inventory_service import CreateInventoryMovementInput, record_inventory_movement
from apps.locations.models import Location, LocationStatus, ZoneUsage
from apps.organizations.models import Organization
from apps.outbound.models import SalesOrder
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.returns.models import (
    ReturnDisposition,
    ReturnDispositionType,
    ReturnLine,
    ReturnLineStatus,
    ReturnOrder,
    ReturnOrderStatus,
    ReturnReceipt,
)
from apps.warehouse.models import Warehouse

ZERO = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class CreateReturnLineInput:
    line_number: int
    product: Product
    expected_qty: Decimal
    return_reason: str = ""
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CreateReturnOrderInput:
    organization: Organization
    warehouse: Warehouse
    customer_account: CustomerAccount
    return_number: str
    order_type: str = OperationOrderType.STANDARD
    sales_order: SalesOrder | None = None
    requested_date: date | None = None
    reference_code: str = ""
    notes: str = ""
    line_items: tuple[CreateReturnLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class CreateReturnReceiptInput:
    return_line: ReturnLine
    warehouse: Warehouse
    receipt_location: Location
    receipt_number: str
    received_qty: Decimal
    stock_status: str = InventoryStatus.QUARANTINE
    lot_number: str = ""
    serial_number: str = ""
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CreateReturnDispositionInput:
    return_receipt: ReturnReceipt
    warehouse: Warehouse
    disposition_number: str
    disposition_type: str
    quantity: Decimal
    to_location: Location | None = None
    notes: str = ""


def _snapshot_customer(return_order: ReturnOrder, customer_account: CustomerAccount) -> None:
    return_order.customer_code = customer_account.code
    return_order.customer_name = customer_account.name
    return_order.customer_contact_name = customer_account.contact_name
    return_order.customer_contact_email = customer_account.contact_email
    return_order.customer_contact_phone = customer_account.contact_phone


def _validate_return_order_scope(
    *,
    organization: Organization,
    warehouse: Warehouse,
    customer_account: CustomerAccount,
    sales_order: SalesOrder | None,
    order_type: str,
) -> None:
    errors: dict[str, str] = {}
    if warehouse.organization_id != organization.id:
        errors["warehouse"] = "Warehouse must belong to the same organization."
    if customer_account.organization_id != organization.id:
        errors["customer_account"] = "Customer account must belong to the same organization."
    if sales_order is not None:
        if sales_order.organization_id != organization.id:
            errors["sales_order"] = "Sales order must belong to the same organization."
        if sales_order.warehouse_id != warehouse.id:
            errors["sales_order"] = "Sales order warehouse must match the selected return warehouse."
        if sales_order.customer_account_id != customer_account.id:
            errors["sales_order"] = "Sales order customer account must match the selected return customer account."
        if sales_order.order_type != order_type:
            errors["order_type"] = "Return order type must match the linked sales order type."
    if errors:
        raise ValidationError(errors)


def _validate_receipt_location(location: Location, *, warehouse: Warehouse) -> None:
    errors: dict[str, str] = {}
    if location.warehouse_id != warehouse.id:
        errors["receipt_location"] = "Return receipt location must belong to the selected warehouse."
    if not location.is_active:
        errors["receipt_location"] = "Return receipt location must be active."
    if location.is_locked:
        errors["receipt_location"] = "Return receipt location is currently locked."
    if location.status != LocationStatus.AVAILABLE:
        errors["receipt_location"] = "Return receipt location is not available."
    if location.zone.usage not in {ZoneUsage.RETURNS, ZoneUsage.QUARANTINE}:
        errors["receipt_location"] = "Return receipt location must be in a returns or quarantine zone."
    if errors:
        raise ValidationError(errors)


def _validate_disposition_location(
    *,
    disposition_type: str,
    return_receipt: ReturnReceipt,
    to_location: Location | None,
) -> None:
    errors: dict[str, str] = {}
    if disposition_type == ReturnDispositionType.SCRAP:
        if to_location is not None:
            errors["to_location"] = "Scrap dispositions must not define a destination location."
    else:
        if to_location is None:
            errors["to_location"] = "This disposition type requires a destination location."
        else:
            if to_location.warehouse_id != return_receipt.warehouse_id:
                errors["to_location"] = "Disposition destination must belong to the receipt warehouse."
            elif not to_location.is_active:
                errors["to_location"] = "Disposition destination must be active."
            elif to_location.is_locked:
                errors["to_location"] = "Disposition destination is currently locked."
            elif to_location.status != LocationStatus.AVAILABLE:
                errors["to_location"] = "Disposition destination is not available."
            elif disposition_type == ReturnDispositionType.RESTOCK:
                if return_receipt.stock_status != InventoryStatus.AVAILABLE:
                    errors["stock_status"] = "Only available return receipts can be restocked."
                elif to_location.zone.usage not in {ZoneUsage.STORAGE, ZoneUsage.PICKING}:
                    errors["to_location"] = "Restock dispositions must target storage or picking zones."
            elif disposition_type == ReturnDispositionType.QUARANTINE:
                if return_receipt.stock_status not in {InventoryStatus.QUARANTINE, InventoryStatus.DAMAGED}:
                    errors["stock_status"] = "Only quarantine or damaged receipts can move through quarantine disposition."
                elif to_location.zone.usage not in {ZoneUsage.QUARANTINE, ZoneUsage.RETURNS}:
                    errors["to_location"] = "Quarantine dispositions must target returns or quarantine zones."
    if errors:
        raise ValidationError(errors)


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
    lines = list(return_order.lines.all())
    if not lines:
        return_order.status = ReturnOrderStatus.CANCELLED if return_order.status == ReturnOrderStatus.CANCELLED else ReturnOrderStatus.OPEN
    elif all(line.status == ReturnLineStatus.COMPLETED for line in lines):
        return_order.status = ReturnOrderStatus.COMPLETED
    elif any(line.disposed_qty > ZERO for line in lines):
        return_order.status = ReturnOrderStatus.PARTIAL_DISPOSED
    elif all(line.received_qty >= line.expected_qty for line in lines):
        return_order.status = ReturnOrderStatus.RECEIVED
    elif any(line.received_qty > ZERO for line in lines):
        return_order.status = ReturnOrderStatus.PARTIAL_RECEIVED
    else:
        return_order.status = ReturnOrderStatus.OPEN
    return_order.save(update_fields=["status", "update_time"])
    return return_order


def list_return_orders(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    order_type: str | None = None,
    status: str | None = None,
    customer_account_id: int | None = None,
) -> list[ReturnOrder]:
    queryset = ReturnOrder.objects.select_related(
        "warehouse",
        "customer_account",
        "sales_order",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if order_type is not None:
        queryset = queryset.filter(order_type=order_type)
    if status is not None:
        queryset = queryset.filter(status=status)
    if customer_account_id is not None:
        queryset = queryset.filter(customer_account_id=customer_account_id)
    return list(queryset.order_by("-create_time", "-id"))


def list_return_receipts(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    return_order_id: int | None = None,
) -> list[ReturnReceipt]:
    queryset = ReturnReceipt.objects.select_related(
        "return_line",
        "return_line__return_order",
        "return_line__product",
        "warehouse",
        "receipt_location",
        "inventory_movement",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if return_order_id is not None:
        queryset = queryset.filter(return_line__return_order_id=return_order_id)
    return list(queryset.order_by("-received_at", "-id"))


def list_return_dispositions(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    disposition_type: str | None = None,
) -> list[ReturnDisposition]:
    queryset = ReturnDisposition.objects.select_related(
        "return_receipt",
        "return_receipt__return_line",
        "return_receipt__return_line__return_order",
        "warehouse",
        "to_location",
        "inventory_movement",
    ).filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if disposition_type is not None:
        queryset = queryset.filter(disposition_type=disposition_type)
    return list(queryset.order_by("-completed_at", "-id"))


@transaction.atomic
def create_return_order(payload: CreateReturnOrderInput) -> ReturnOrder:
    if not payload.line_items:
        raise ValidationError({"line_items": "Return orders require at least one line item."})
    _validate_return_order_scope(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        sales_order=payload.sales_order,
        order_type=payload.order_type,
    )
    return_order = ReturnOrder(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        sales_order=payload.sales_order,
        order_type=payload.order_type,
        return_number=payload.return_number,
        requested_date=payload.requested_date,
        reference_code=payload.reference_code,
        notes=payload.notes,
    )
    _snapshot_customer(return_order, payload.customer_account)
    return_order.save()

    seen_line_numbers: set[int] = set()
    for item in payload.line_items:
        if item.line_number in seen_line_numbers:
            raise ValidationError({"line_items": "Return line numbers must be unique."})
        if item.product.organization_id != payload.organization.id:
            raise ValidationError({"line_items": "Each return line product must belong to the same organization."})
        seen_line_numbers.add(item.line_number)
        ReturnLine.objects.create(
            organization=payload.organization,
            return_order=return_order,
            line_number=item.line_number,
            product=item.product,
            expected_qty=item.expected_qty,
            return_reason=item.return_reason,
            notes=item.notes,
        )
    refresh_return_order_status(return_order)
    return return_order


@transaction.atomic
def record_return_receipt(
    *,
    payload: CreateReturnReceiptInput,
    operator_name: str,
) -> ReturnReceipt:
    return_line = ReturnLine.objects.select_for_update(of=("self",)).select_related(
        "return_order",
        "product",
    ).get(pk=payload.return_line.pk)
    if return_line.status == ReturnLineStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled return lines cannot receive stock."})
    if return_line.return_order.status == ReturnOrderStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled return orders cannot receive stock."})
    if payload.warehouse.id != return_line.return_order.warehouse_id:
        raise ValidationError({"warehouse": "Receipt warehouse must match the return order warehouse."})
    _validate_receipt_location(payload.receipt_location, warehouse=payload.warehouse)

    remaining_qty = return_line.expected_qty - return_line.received_qty
    if payload.received_qty > remaining_qty:
        raise ValidationError({"received_qty": "Received quantity cannot exceed the remaining expected return quantity."})

    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=return_line.organization,
            warehouse=payload.warehouse,
            product=return_line.product,
            movement_type=MovementType.RECEIPT,
            quantity=payload.received_qty,
            performed_by=operator_name.strip() or "system",
            to_location=payload.receipt_location,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number.strip(),
            serial_number=payload.serial_number.strip(),
            reference_code=payload.receipt_number,
            reason="RETURN_RECEIPT",
        )
    )
    receipt = ReturnReceipt.objects.create(
        organization=return_line.organization,
        return_line=return_line,
        warehouse=payload.warehouse,
        receipt_location=payload.receipt_location,
        receipt_number=payload.receipt_number,
        received_qty=payload.received_qty,
        stock_status=payload.stock_status,
        lot_number=payload.lot_number.strip(),
        serial_number=payload.serial_number.strip(),
        notes=payload.notes,
        received_by=operator_name.strip() or "system",
        inventory_movement=movement,
    )
    return_line.received_qty += payload.received_qty
    return_line.save(update_fields=["received_qty", "update_time"])
    _refresh_return_line_status(return_line)
    refresh_return_order_status(return_line.return_order)
    return receipt


@transaction.atomic
def record_return_disposition(
    *,
    payload: CreateReturnDispositionInput,
    operator_name: str,
) -> ReturnDisposition:
    return_receipt = ReturnReceipt.objects.select_for_update(of=("self",)).select_related(
        "return_line",
        "return_line__return_order",
        "return_line__product",
        "receipt_location",
        "warehouse",
    ).get(pk=payload.return_receipt.pk)
    if return_receipt.return_line.status == ReturnLineStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled return lines cannot be disposed."})
    if payload.warehouse.id != return_receipt.warehouse_id:
        raise ValidationError({"warehouse": "Disposition warehouse must match the return receipt warehouse."})
    _validate_disposition_location(
        disposition_type=payload.disposition_type,
        return_receipt=return_receipt,
        to_location=payload.to_location,
    )
    remaining_qty = return_receipt.received_qty - return_receipt.disposed_qty
    if payload.quantity > remaining_qty:
        raise ValidationError({"quantity": "Disposition quantity cannot exceed the remaining received quantity."})

    if payload.disposition_type == ReturnDispositionType.SCRAP:
        movement_type = MovementType.ADJUSTMENT_OUT
        stock_status = return_receipt.stock_status
        from_location = return_receipt.receipt_location
        to_location = None
        reason = "RETURN_SCRAP"
    elif payload.disposition_type == ReturnDispositionType.RESTOCK:
        movement_type = MovementType.TRANSFER
        stock_status = InventoryStatus.AVAILABLE
        from_location = return_receipt.receipt_location
        to_location = payload.to_location
        reason = "RETURN_RESTOCK"
    else:
        movement_type = MovementType.TRANSFER
        stock_status = return_receipt.stock_status
        from_location = return_receipt.receipt_location
        to_location = payload.to_location
        reason = "RETURN_QUARANTINE"

    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=return_receipt.organization,
            warehouse=payload.warehouse,
            product=return_receipt.return_line.product,
            movement_type=movement_type,
            quantity=payload.quantity,
            performed_by=operator_name.strip() or "system",
            from_location=from_location,
            to_location=to_location,
            stock_status=stock_status,
            lot_number=return_receipt.lot_number,
            serial_number=return_receipt.serial_number,
            reference_code=payload.disposition_number,
            reason=reason,
        )
    )
    disposition = ReturnDisposition.objects.create(
        organization=return_receipt.organization,
        return_receipt=return_receipt,
        warehouse=payload.warehouse,
        disposition_number=payload.disposition_number,
        disposition_type=payload.disposition_type,
        quantity=payload.quantity,
        to_location=payload.to_location,
        notes=payload.notes,
        completed_by=operator_name.strip() or "system",
        completed_at=timezone.now(),
        inventory_movement=movement,
    )
    return_receipt.disposed_qty += payload.quantity
    return_receipt.save(update_fields=["disposed_qty", "update_time"])
    return_line = return_receipt.return_line
    return_line.disposed_qty += payload.quantity
    return_line.save(update_fields=["disposed_qty", "update_time"])
    _refresh_return_line_status(return_line)
    refresh_return_order_status(return_line.return_order)
    return disposition
