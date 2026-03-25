from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.inbound.models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    AdvanceShipmentNoticeStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderLineStatus,
    PurchaseOrderStatus,
    PutawayTask,
    PutawayTaskStatus,
    Receipt,
    ReceiptLine,
)
from apps.inventory.models import InventoryStatus, MovementType
from apps.inventory.services.inventory_service import CreateInventoryMovementInput, record_inventory_movement
from apps.locations.models import Location, LocationStatus
from apps.organizations.models import Organization, OrganizationMembership
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse

ZERO = Decimal("0.0000")
_UNSET = object()


@dataclass(frozen=True, slots=True)
class CreatePurchaseOrderLineInput:
    line_number: int
    product: Product
    ordered_qty: Decimal
    unit_cost: Decimal = ZERO
    stock_status: str = InventoryStatus.AVAILABLE


@dataclass(frozen=True, slots=True)
class CreatePurchaseOrderInput:
    organization: Organization
    warehouse: Warehouse
    customer_account: CustomerAccount
    order_type: str = OperationOrderType.STANDARD
    po_number: str = ""
    supplier_code: str = ""
    supplier_name: str = ""
    supplier_contact_name: str = ""
    supplier_contact_phone: str = ""
    expected_arrival_date: date | None = None
    reference_code: str = ""
    notes: str = ""
    line_items: tuple[CreatePurchaseOrderLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class CreateAdvanceShipmentNoticeLineInput:
    line_number: int
    purchase_order_line: PurchaseOrderLine
    expected_qty: Decimal
    stock_status: str = InventoryStatus.AVAILABLE
    expected_lpn_code: str = ""
    notes: str = ""


@dataclass(frozen=True, slots=True)
class CreateAdvanceShipmentNoticeInput:
    purchase_order: PurchaseOrder
    asn_number: str
    expected_arrival_date: date | None = None
    reference_code: str = ""
    notes: str = ""
    line_items: tuple[CreateAdvanceShipmentNoticeLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class ReceiptLineInput:
    purchase_order_line: PurchaseOrderLine
    received_qty: Decimal
    stock_status: str = InventoryStatus.AVAILABLE
    lot_number: str = ""
    serial_number: str = ""
    unit_cost: Decimal = ZERO
    asn_line: AdvanceShipmentNoticeLine | None = None


@dataclass(frozen=True, slots=True)
class CreateReceiptInput:
    purchase_order: PurchaseOrder
    warehouse: Warehouse
    receipt_location: Location
    receipt_number: str
    asn: AdvanceShipmentNotice | None = None
    reference_code: str = ""
    notes: str = ""
    line_items: tuple[ReceiptLineInput, ...] = ()


def _snapshot_customer(po: PurchaseOrder, customer_account: CustomerAccount) -> None:
    po.customer_code = customer_account.code
    po.customer_name = customer_account.name


def _validate_purchase_order_scope(
    *,
    organization: Organization,
    warehouse: Warehouse,
    customer_account: CustomerAccount,
) -> None:
    errors: dict[str, str] = {}
    if warehouse.organization_id != organization.id:
        errors["warehouse"] = "Warehouse must belong to the same organization."
    if customer_account.organization_id != organization.id:
        errors["customer_account"] = "Customer account must belong to the same organization."
    if not customer_account.allow_inbound_goods:
        errors["customer_account"] = "Customer account is not enabled for inbound goods."
    if errors:
        raise ValidationError(errors)


def _validate_receiving_location(location: Location, *, warehouse: Warehouse) -> None:
    errors: dict[str, str] = {}
    if location.warehouse_id != warehouse.id:
        errors["receipt_location"] = "Receipt location must belong to the selected warehouse."
    if not location.is_active:
        errors["receipt_location"] = "Receipt location must be active."
    if location.is_locked:
        errors["receipt_location"] = "Receipt location is currently locked."
    if location.status != LocationStatus.AVAILABLE:
        errors["receipt_location"] = "Receipt location is not available."
    if errors:
        raise ValidationError(errors)


def _validate_putaway_destination(location: Location, *, warehouse: Warehouse) -> None:
    errors: dict[str, str] = {}
    if location.warehouse_id != warehouse.id:
        errors["to_location"] = "Putaway destination must belong to the selected warehouse."
    if not location.is_active:
        errors["to_location"] = "Putaway destination must be active."
    if location.is_locked:
        errors["to_location"] = "Putaway destination is currently locked."
    if location.status != LocationStatus.AVAILABLE:
        errors["to_location"] = "Putaway destination is not available."
    if errors:
        raise ValidationError(errors)


def _purchase_order_line_status(line: PurchaseOrderLine) -> str:
    if line.status == PurchaseOrderLineStatus.CANCELLED:
        return PurchaseOrderLineStatus.CANCELLED
    if line.received_qty >= line.ordered_qty:
        return PurchaseOrderLineStatus.CLOSED
    if line.received_qty > ZERO:
        return PurchaseOrderLineStatus.PARTIAL
    return PurchaseOrderLineStatus.OPEN


def _asn_line_status(line: AdvanceShipmentNoticeLine) -> str:
    if line.received_qty >= line.expected_qty:
        return AdvanceShipmentNoticeStatus.RECEIVED
    if line.received_qty > ZERO:
        return AdvanceShipmentNoticeStatus.PARTIAL
    return AdvanceShipmentNoticeStatus.OPEN


def refresh_purchase_order_status(purchase_order: PurchaseOrder) -> PurchaseOrder:
    lines = list(purchase_order.lines.all())
    if not lines:
        purchase_order.status = PurchaseOrderStatus.CANCELLED if purchase_order.status == PurchaseOrderStatus.CANCELLED else PurchaseOrderStatus.OPEN
    elif all(line.status == PurchaseOrderLineStatus.CLOSED for line in lines):
        purchase_order.status = PurchaseOrderStatus.CLOSED
    elif any(line.received_qty > ZERO for line in lines):
        purchase_order.status = PurchaseOrderStatus.PARTIAL
    else:
        purchase_order.status = PurchaseOrderStatus.OPEN
    purchase_order.save(update_fields=["status", "update_time"])
    return purchase_order


def refresh_asn_status(asn: AdvanceShipmentNotice) -> AdvanceShipmentNotice:
    lines = list(asn.lines.all())
    if not lines:
        asn.status = AdvanceShipmentNoticeStatus.CANCELLED if asn.status == AdvanceShipmentNoticeStatus.CANCELLED else AdvanceShipmentNoticeStatus.OPEN
    elif all(line.received_qty >= line.expected_qty for line in lines):
        asn.status = AdvanceShipmentNoticeStatus.RECEIVED
    elif any(line.received_qty > ZERO for line in lines):
        asn.status = AdvanceShipmentNoticeStatus.PARTIAL
    else:
        asn.status = AdvanceShipmentNoticeStatus.OPEN
    asn.save(update_fields=["status", "update_time"])
    return asn


def list_purchase_orders(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    order_type: str | None = None,
    status: str | None = None,
    customer_account_id: int | None = None,
) -> list[PurchaseOrder]:
    queryset = PurchaseOrder.objects.select_related("warehouse", "customer_account").prefetch_related("lines").filter(
        organization=organization
    )
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if order_type is not None:
        queryset = queryset.filter(order_type=order_type)
    if status is not None:
        queryset = queryset.filter(status=status)
    if customer_account_id is not None:
        queryset = queryset.filter(customer_account_id=customer_account_id)
    return list(queryset.order_by("-create_time", "-id"))


def list_asns(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    purchase_order_id: int | None = None,
    status: str | None = None,
) -> list[AdvanceShipmentNotice]:
    queryset = AdvanceShipmentNotice.objects.select_related(
        "purchase_order",
        "warehouse",
        "customer_account",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if purchase_order_id is not None:
        queryset = queryset.filter(purchase_order_id=purchase_order_id)
    if status is not None:
        queryset = queryset.filter(status=status)
    return list(queryset.order_by("-create_time", "-id"))


def list_receipts(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    purchase_order_id: int | None = None,
) -> list[Receipt]:
    queryset = Receipt.objects.select_related(
        "purchase_order",
        "warehouse",
        "receipt_location",
        "asn",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if purchase_order_id is not None:
        queryset = queryset.filter(purchase_order_id=purchase_order_id)
    return list(queryset.order_by("-received_at", "-id"))


def list_putaway_tasks(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
    assigned_membership_id: int | None = None,
) -> list[PutawayTask]:
    queryset = PutawayTask.objects.select_related(
        "receipt_line",
        "receipt_line__receipt",
        "product",
        "warehouse",
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
    return list(queryset.order_by("status", "create_time", "id"))


@transaction.atomic
def create_purchase_order(payload: CreatePurchaseOrderInput) -> PurchaseOrder:
    if not payload.line_items:
        raise ValidationError({"line_items": "Purchase orders require at least one line item."})
    _validate_purchase_order_scope(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
    )
    purchase_order = PurchaseOrder(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        order_type=payload.order_type,
        po_number=payload.po_number,
        supplier_code=payload.supplier_code,
        supplier_name=payload.supplier_name,
        supplier_contact_name=payload.supplier_contact_name,
        supplier_contact_phone=payload.supplier_contact_phone,
        expected_arrival_date=payload.expected_arrival_date,
        reference_code=payload.reference_code,
        notes=payload.notes,
    )
    _snapshot_customer(purchase_order, payload.customer_account)
    purchase_order.save()

    seen_line_numbers: set[int] = set()
    for item in payload.line_items:
        if item.line_number in seen_line_numbers:
            raise ValidationError({"line_items": "Purchase order line numbers must be unique."})
        if item.product.organization_id != payload.organization.id:
            raise ValidationError({"line_items": "Each purchase order line product must belong to the same organization."})
        seen_line_numbers.add(item.line_number)
        PurchaseOrderLine.objects.create(
            organization=payload.organization,
            purchase_order=purchase_order,
            line_number=item.line_number,
            product=item.product,
            ordered_qty=item.ordered_qty,
            unit_cost=item.unit_cost,
            stock_status=item.stock_status,
        )
    refresh_purchase_order_status(purchase_order)
    return purchase_order


@transaction.atomic
def create_asn(payload: CreateAdvanceShipmentNoticeInput) -> AdvanceShipmentNotice:
    if not payload.line_items:
        raise ValidationError({"line_items": "ASNs require at least one line item."})
    purchase_order = PurchaseOrder.objects.select_for_update().get(pk=payload.purchase_order.pk)
    if purchase_order.status == PurchaseOrderStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled purchase orders cannot receive an ASN."})
    asn = AdvanceShipmentNotice.objects.create(
        organization=purchase_order.organization,
        purchase_order=purchase_order,
        warehouse=purchase_order.warehouse,
        customer_account=purchase_order.customer_account,
        order_type=purchase_order.order_type,
        asn_number=payload.asn_number,
        expected_arrival_date=payload.expected_arrival_date,
        reference_code=payload.reference_code,
        notes=payload.notes,
    )
    seen_line_numbers: set[int] = set()
    for item in payload.line_items:
        if item.line_number in seen_line_numbers:
            raise ValidationError({"line_items": "ASN line numbers must be unique."})
        if item.purchase_order_line.purchase_order_id != purchase_order.id:
            raise ValidationError({"line_items": "ASN line purchase order line must belong to the purchase order."})
        seen_line_numbers.add(item.line_number)
        AdvanceShipmentNoticeLine.objects.create(
            organization=purchase_order.organization,
            asn=asn,
            line_number=item.line_number,
            purchase_order_line=item.purchase_order_line,
            product=item.purchase_order_line.product,
            expected_qty=item.expected_qty,
            stock_status=item.stock_status,
            expected_lpn_code=item.expected_lpn_code,
            notes=item.notes,
        )
    refresh_asn_status(asn)
    return asn


def _record_receipt_line(
    *,
    receipt: Receipt,
    purchase_order_line: PurchaseOrderLine,
    received_qty: Decimal,
    stock_status: str,
    lot_number: str,
    serial_number: str,
    unit_cost: Decimal,
    operator_name: str,
    asn_line: AdvanceShipmentNoticeLine | None = None,
) -> ReceiptLine:
    if purchase_order_line.purchase_order_id != receipt.purchase_order_id:
        raise ValidationError({"purchase_order_line": "Purchase order line must belong to the selected purchase order."})
    remaining_qty = purchase_order_line.ordered_qty - purchase_order_line.received_qty
    if received_qty > remaining_qty:
        raise ValidationError({"received_qty": "Received quantity cannot exceed the remaining purchase order quantity."})
    if asn_line is not None:
        if receipt.asn_id is None or asn_line.asn_id != receipt.asn_id:
            raise ValidationError({"asn_line": "ASN line must belong to the selected ASN."})
        asn_remaining_qty = asn_line.expected_qty - asn_line.received_qty
        if received_qty > asn_remaining_qty:
            raise ValidationError({"received_qty": "Received quantity cannot exceed the remaining ASN quantity."})

    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=receipt.organization,
            warehouse=receipt.warehouse,
            product=purchase_order_line.product,
            movement_type=MovementType.RECEIPT,
            quantity=received_qty,
            performed_by=operator_name.strip() or "system",
            to_location=receipt.receipt_location,
            stock_status=stock_status,
            lot_number=lot_number,
            serial_number=serial_number,
            unit_cost=unit_cost,
            reference_code=receipt.receipt_number,
            reason="INBOUND_RECEIPT",
        )
    )
    receipt_line = ReceiptLine.objects.create(
        organization=receipt.organization,
        asn_line=asn_line,
        receipt=receipt,
        purchase_order_line=purchase_order_line,
        product=purchase_order_line.product,
        receipt_location=receipt.receipt_location,
        received_qty=received_qty,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        unit_cost=unit_cost,
        inventory_movement=movement,
    )
    purchase_order_line.received_qty += received_qty
    purchase_order_line.status = _purchase_order_line_status(purchase_order_line)
    purchase_order_line.save(update_fields=["received_qty", "status", "update_time"])
    if asn_line is not None:
        asn_line.received_qty += received_qty
        asn_line.save(update_fields=["received_qty", "update_time"])
    PutawayTask.objects.create(
        organization=receipt.organization,
        receipt_line=receipt_line,
        warehouse=receipt.warehouse,
        product=purchase_order_line.product,
        task_number=f"PT-{receipt.receipt_number}-{purchase_order_line.line_number}",
        from_location=receipt.receipt_location,
        quantity=received_qty,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
    )
    return receipt_line


@transaction.atomic
def record_receipt(
    *,
    payload: CreateReceiptInput,
    operator_name: str,
) -> Receipt:
    if not payload.line_items:
        raise ValidationError({"line_items": "Receipts require at least one receipt line."})
    purchase_order = PurchaseOrder.objects.select_for_update().get(pk=payload.purchase_order.pk)
    if purchase_order.status in {PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.CLOSED}:
        raise ValidationError({"status": "This purchase order is no longer open for receipt."})
    if payload.warehouse.id != purchase_order.warehouse_id:
        raise ValidationError({"warehouse": "Receipt warehouse must match the purchase order warehouse."})
    if payload.asn is not None and payload.asn.purchase_order_id != purchase_order.id:
        raise ValidationError({"asn": "ASN must belong to the selected purchase order."})
    _validate_receiving_location(payload.receipt_location, warehouse=payload.warehouse)

    receipt = Receipt.objects.create(
        organization=purchase_order.organization,
        asn=payload.asn,
        purchase_order=purchase_order,
        warehouse=payload.warehouse,
        receipt_location=payload.receipt_location,
        receipt_number=payload.receipt_number,
        reference_code=payload.reference_code,
        notes=payload.notes,
        received_by=operator_name.strip() or "system",
    )
    for item in payload.line_items:
        _record_receipt_line(
            receipt=receipt,
            purchase_order_line=item.purchase_order_line,
            received_qty=item.received_qty,
            stock_status=item.stock_status,
            lot_number=item.lot_number.strip(),
            serial_number=item.serial_number.strip(),
            unit_cost=item.unit_cost,
            operator_name=operator_name,
            asn_line=item.asn_line,
        )
    refresh_purchase_order_status(purchase_order)
    if payload.asn is not None:
        refresh_asn_status(payload.asn)
    return receipt


@transaction.atomic
def complete_putaway_task(
    putaway_task: PutawayTask,
    *,
    operator_name: str,
    membership: OrganizationMembership | None = None,
    to_location: Location | None,
) -> PutawayTask:
    task = PutawayTask.objects.select_for_update(of=("self",)).select_related(
        "warehouse",
        "product",
        "from_location",
        "receipt_line",
        "receipt_line__receipt",
    ).get(pk=putaway_task.pk)
    if task.status == PutawayTaskStatus.COMPLETED:
        return task
    if task.status == PutawayTaskStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled putaway tasks cannot be completed."})
    if task.assigned_membership_id is not None and membership is not None and task.assigned_membership_id != membership.id:
        raise ValidationError({"assigned_membership": "Putaway task is assigned to a different membership."})

    destination = to_location or task.to_location
    if destination is None:
        raise ValidationError({"to_location": "Putaway completion requires a destination location."})
    _validate_putaway_destination(destination, warehouse=task.warehouse)

    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=task.organization,
            warehouse=task.warehouse,
            product=task.product,
            movement_type=MovementType.PUTAWAY,
            quantity=task.quantity,
            performed_by=operator_name.strip() or "system",
            from_location=task.from_location,
            to_location=destination,
            stock_status=task.stock_status,
            lot_number=task.lot_number,
            serial_number=task.serial_number,
            unit_cost=task.receipt_line.unit_cost,
            reference_code=task.task_number,
            reason="INBOUND_PUTAWAY",
        )
    )
    task.to_location = destination
    task.status = PutawayTaskStatus.COMPLETED
    task.completed_by = operator_name.strip() or "system"
    task.completed_at = timezone.now()
    task.inventory_movement = movement
    task.save(update_fields=["to_location", "status", "completed_by", "completed_at", "inventory_movement", "update_time"])
    return task
