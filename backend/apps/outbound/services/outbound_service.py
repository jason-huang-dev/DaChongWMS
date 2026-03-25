from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import F, QuerySet
from django.utils import timezone

from apps.common.operation_types import OperationOrderType
from apps.inventory.models import InventoryBalance, InventoryStatus, MovementType
from apps.inventory.services.inventory_service import CreateInventoryMovementInput, record_inventory_movement
from apps.locations.models import Location, LocationStatus
from apps.organizations.models import Organization, OrganizationMembership
from apps.outbound.models import (
    PickTask,
    PickTaskStatus,
    SalesOrder,
    SalesOrderExceptionState,
    SalesOrderFulfillmentStage,
    SalesOrderLine,
    SalesOrderLineStatus,
    SalesOrderStatus,
    Shipment,
    ShipmentLine,
    ShipmentStatus,
)
from apps.partners.models import CustomerAccount
from apps.products.models import Product
from apps.warehouse.models import Warehouse

_UNSET = object()
ZERO = Decimal("0.0000")


@dataclass(frozen=True, slots=True)
class CreateSalesOrderLineInput:
    line_number: int
    product: Product
    ordered_qty: Decimal
    unit_price: Decimal = ZERO
    stock_status: str = InventoryStatus.AVAILABLE


@dataclass(frozen=True, slots=True)
class CreateSalesOrderInput:
    organization: Organization
    warehouse: Warehouse
    customer_account: CustomerAccount
    staging_location: Location
    order_type: str = OperationOrderType.DROPSHIP
    order_number: str = ""
    order_time: datetime | None = None
    requested_ship_date: date | None = None
    expires_at: datetime | None = None
    reference_code: str = ""
    package_count: int = 0
    package_type: str = ""
    package_weight: Decimal = ZERO
    package_length: Decimal = ZERO
    package_width: Decimal = ZERO
    package_height: Decimal = ZERO
    package_volume: Decimal = ZERO
    logistics_provider: str = ""
    shipping_method: str = ""
    tracking_number: str = ""
    waybill_number: str = ""
    waybill_printed: bool = False
    deliverer_name: str = ""
    deliverer_phone: str = ""
    receiver_name: str = ""
    receiver_phone: str = ""
    receiver_country: str = ""
    receiver_state: str = ""
    receiver_city: str = ""
    receiver_address: str = ""
    receiver_postal_code: str = ""
    exception_state: str = SalesOrderExceptionState.NORMAL
    exception_notes: str = ""
    notes: str = ""
    line_items: tuple[CreateSalesOrderLineInput, ...] = ()


@dataclass(frozen=True, slots=True)
class CreateShipmentInput:
    shipment_number: str


def _validate_scope(
    *,
    organization: Organization,
    warehouse: Warehouse,
    customer_account: CustomerAccount,
    staging_location: Location,
) -> None:
    errors: dict[str, str] = {}
    if warehouse.organization_id != organization.id:
        errors["warehouse"] = "Warehouse must belong to the same organization."
    if customer_account.organization_id != organization.id:
        errors["customer_account"] = "Customer account must belong to the same organization."
    if staging_location.organization_id != organization.id:
        errors["staging_location"] = "Staging location must belong to the same organization."
    if staging_location.warehouse_id != warehouse.id:
        errors["staging_location"] = "Staging location must belong to the same warehouse."
    if not staging_location.is_active:
        errors["staging_location"] = "Staging location must be active."
    if staging_location.is_locked:
        errors["staging_location"] = "Staging location is currently locked."
    if errors:
        raise ValidationError(errors)


def _snapshot_customer(order: SalesOrder, customer_account: CustomerAccount) -> None:
    order.customer_code = customer_account.code
    order.customer_name = customer_account.name
    order.customer_contact_name = customer_account.contact_name
    order.customer_contact_email = customer_account.contact_email
    order.customer_contact_phone = customer_account.contact_phone
    if not order.shipping_method:
        order.shipping_method = customer_account.shipping_method


def _line_status(line: SalesOrderLine) -> str:
    if line.status == SalesOrderLineStatus.CANCELLED:
        return SalesOrderLineStatus.CANCELLED
    if line.shipped_qty >= line.ordered_qty:
        return SalesOrderLineStatus.SHIPPED
    if line.picked_qty >= line.ordered_qty:
        return SalesOrderLineStatus.PICKED
    if line.picked_qty > ZERO or line.allocated_qty > ZERO or line.shipped_qty > ZERO:
        return SalesOrderLineStatus.PARTIAL if line.allocated_qty < line.ordered_qty else SalesOrderLineStatus.ALLOCATED
    return SalesOrderLineStatus.OPEN


def _derive_fulfillment_stage(order: SalesOrder) -> str:
    if order.status == SalesOrderStatus.CANCELLED:
        return SalesOrderFulfillmentStage.CANCELLED
    if order.status == SalesOrderStatus.SHIPPED:
        return SalesOrderFulfillmentStage.SHIPPED
    if order.packed_at is not None or order.status == SalesOrderStatus.PICKED:
        return SalesOrderFulfillmentStage.TO_SHIP
    if order.status in {SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING}:
        return SalesOrderFulfillmentStage.IN_PROCESS
    if order.tracking_number or order.waybill_number or order.logistics_provider:
        return SalesOrderFulfillmentStage.TO_MOVE
    return SalesOrderFulfillmentStage.GET_TRACKING_NO


def refresh_sales_order_status(sales_order: SalesOrder) -> SalesOrder:
    lines = list(sales_order.lines.all())
    if not lines:
        sales_order.status = SalesOrderStatus.CANCELLED if sales_order.status == SalesOrderStatus.CANCELLED else SalesOrderStatus.OPEN
    elif all(line.status == SalesOrderLineStatus.SHIPPED for line in lines):
        sales_order.status = SalesOrderStatus.SHIPPED
    elif all(line.status == SalesOrderLineStatus.PICKED for line in lines):
        sales_order.status = SalesOrderStatus.PICKED
    elif any(line.status in {SalesOrderLineStatus.ALLOCATED, SalesOrderLineStatus.PARTIAL, SalesOrderLineStatus.PICKED} for line in lines):
        sales_order.status = SalesOrderStatus.ALLOCATED
    else:
        sales_order.status = SalesOrderStatus.OPEN

    if all(line.status == SalesOrderLineStatus.SHIPPED for line in lines):
        sales_order.picking_completed_at = sales_order.picking_completed_at or timezone.now()
    sales_order.fulfillment_stage = _derive_fulfillment_stage(sales_order)
    sales_order.save(update_fields=["status", "fulfillment_stage", "picking_completed_at", "update_time"])
    return sales_order


def list_sales_orders(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    order_type: str | None = None,
    status: str | None = None,
    customer_account_id: int | None = None,
) -> list[SalesOrder]:
    queryset = SalesOrder.objects.select_related(
        "warehouse",
        "customer_account",
        "staging_location",
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


def list_pick_tasks(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    status: str | None = None,
    assigned_membership_id: int | None = None,
) -> list[PickTask]:
    queryset = PickTask.objects.select_related(
        "sales_order_line",
        "sales_order_line__sales_order",
        "sales_order_line__product",
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
    return list(queryset.order_by("sales_order_line__sales_order_id", "task_number", "id"))


def list_shipments(
    *,
    organization: Organization,
    warehouse_id: int | None = None,
    order_type: str | None = None,
) -> list[Shipment]:
    queryset = Shipment.objects.select_related(
        "sales_order",
        "warehouse",
    ).prefetch_related("lines").filter(organization=organization)
    if warehouse_id is not None:
        queryset = queryset.filter(warehouse_id=warehouse_id)
    if order_type is not None:
        queryset = queryset.filter(sales_order__order_type=order_type)
    return list(queryset.order_by("-shipped_at", "-id"))


@transaction.atomic
def create_sales_order(payload: CreateSalesOrderInput) -> SalesOrder:
    if not payload.line_items:
        raise ValidationError({"line_items": "Sales orders require at least one line item."})
    _validate_scope(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        staging_location=payload.staging_location,
    )
    if payload.order_type == OperationOrderType.DROPSHIP and not payload.customer_account.allow_dropshipping_orders:
        raise ValidationError({"customer_account": "Customer account does not allow dropshipping orders."})

    sales_order = SalesOrder(
        organization=payload.organization,
        warehouse=payload.warehouse,
        customer_account=payload.customer_account,
        staging_location=payload.staging_location,
        order_type=payload.order_type,
        order_number=payload.order_number,
        order_time=payload.order_time,
        requested_ship_date=payload.requested_ship_date,
        expires_at=payload.expires_at,
        reference_code=payload.reference_code,
        exception_state=payload.exception_state,
        package_count=payload.package_count,
        package_type=payload.package_type,
        package_weight=payload.package_weight,
        package_length=payload.package_length,
        package_width=payload.package_width,
        package_height=payload.package_height,
        package_volume=payload.package_volume,
        logistics_provider=payload.logistics_provider,
        shipping_method=payload.shipping_method,
        tracking_number=payload.tracking_number,
        waybill_number=payload.waybill_number,
        waybill_printed=payload.waybill_printed,
        deliverer_name=payload.deliverer_name,
        deliverer_phone=payload.deliverer_phone,
        receiver_name=payload.receiver_name,
        receiver_phone=payload.receiver_phone,
        receiver_country=payload.receiver_country,
        receiver_state=payload.receiver_state,
        receiver_city=payload.receiver_city,
        receiver_address=payload.receiver_address,
        receiver_postal_code=payload.receiver_postal_code,
        exception_notes=payload.exception_notes,
        notes=payload.notes,
    )
    _snapshot_customer(sales_order, payload.customer_account)
    sales_order.fulfillment_stage = _derive_fulfillment_stage(sales_order)
    sales_order.save()

    seen_line_numbers: set[int] = set()
    for item in payload.line_items:
        if item.line_number in seen_line_numbers:
            raise ValidationError({"line_items": "Sales order line numbers must be unique."})
        if item.product.organization_id != payload.organization.id:
            raise ValidationError({"line_items": "Each sales order line product must belong to the same organization."})
        seen_line_numbers.add(item.line_number)
        SalesOrderLine.objects.create(
            organization=payload.organization,
            sales_order=sales_order,
            line_number=item.line_number,
            product=item.product,
            ordered_qty=item.ordered_qty,
            unit_price=item.unit_price,
            stock_status=item.stock_status,
        )
    refresh_sales_order_status(sales_order)
    return sales_order


@transaction.atomic
def update_sales_order(
    sales_order: SalesOrder,
    *,
    customer_account: CustomerAccount | object = _UNSET,
    reference_code: str | object = _UNSET,
    tracking_number: str | object = _UNSET,
    waybill_number: str | object = _UNSET,
    waybill_printed: bool | object = _UNSET,
    packed_at: datetime | None | object = _UNSET,
    notes: str | object = _UNSET,
    exception_state: str | object = _UNSET,
    exception_notes: str | object = _UNSET,
) -> SalesOrder:
    order = SalesOrder.objects.select_for_update(of=("self",)).select_related("customer_account").get(pk=sales_order.pk)
    if customer_account is not _UNSET:
        assert isinstance(customer_account, CustomerAccount)
        if order.order_type == OperationOrderType.DROPSHIP and not customer_account.allow_dropshipping_orders:
            raise ValidationError({"customer_account": "Customer account does not allow dropshipping orders."})
        order.customer_account = customer_account
        _snapshot_customer(order, customer_account)
    if reference_code is not _UNSET:
        order.reference_code = str(reference_code)
    if tracking_number is not _UNSET:
        order.tracking_number = str(tracking_number)
    if waybill_number is not _UNSET:
        order.waybill_number = str(waybill_number)
    if waybill_printed is not _UNSET:
        order.waybill_printed = bool(waybill_printed)
    if packed_at is not _UNSET:
        order.packed_at = packed_at
    if notes is not _UNSET:
        order.notes = str(notes)
    if exception_state is not _UNSET:
        order.exception_state = str(exception_state)
    if exception_notes is not _UNSET:
        order.exception_notes = str(exception_notes)
    order.fulfillment_stage = _derive_fulfillment_stage(order)
    order.save()
    return refresh_sales_order_status(order)


def _pickable_balances_for_line(line: SalesOrderLine) -> QuerySet[InventoryBalance]:
    return InventoryBalance.objects.select_for_update(of=("self",)).select_related("location").filter(
        organization=line.organization,
        warehouse=line.sales_order.warehouse,
        product=line.product,
        stock_status=line.stock_status,
        on_hand_qty__gt=F("allocated_qty") + F("hold_qty"),
        location__is_active=True,
        location__is_locked=False,
        location__is_pick_face=True,
        location__status=LocationStatus.AVAILABLE,
    ).order_by("location__pick_sequence", "location__code", "id")


@transaction.atomic
def allocate_sales_order(sales_order: SalesOrder) -> SalesOrder:
    order = SalesOrder.objects.select_for_update().get(pk=sales_order.pk)
    if order.status in {SalesOrderStatus.CANCELLED, SalesOrderStatus.SHIPPED}:
        raise ValidationError({"status": "Closed sales orders cannot be allocated."})

    created_tasks = 0
    for line in order.lines.select_for_update(of=("self",)).select_related("product").all():
        remaining_qty = line.ordered_qty - line.allocated_qty - line.picked_qty - line.shipped_qty
        if remaining_qty <= ZERO:
            continue
        balances = list(_pickable_balances_for_line(line))
        for balance in balances:
            if remaining_qty <= ZERO:
                break
            available_qty = balance.available_qty
            if available_qty <= ZERO:
                continue
            allocated_qty = min(available_qty, remaining_qty)
            balance.allocated_qty += allocated_qty
            balance.save(update_fields=["allocated_qty"])
            line.allocated_qty += allocated_qty
            created_tasks += 1
            PickTask.objects.create(
                organization=order.organization,
                sales_order_line=line,
                warehouse=order.warehouse,
                from_location=balance.location,
                to_location=order.staging_location,
                task_number=f"PK-{order.order_number}-{line.line_number}-{created_tasks}",
                quantity=allocated_qty,
                stock_status=line.stock_status,
                lot_number=balance.lot_number,
                serial_number=balance.serial_number,
            )
            remaining_qty -= allocated_qty
        line.status = _line_status(line)
        line.save(update_fields=["allocated_qty", "status", "update_time"])
        if remaining_qty > ZERO:
            raise ValidationError({"quantity": f"Insufficient available inventory to allocate order line {line.line_number}."})

    if created_tasks:
        order.picking_started_at = order.picking_started_at or timezone.now()
    refresh_sales_order_status(order)
    return order


def _ensure_execution_access(pick_task: PickTask, membership: OrganizationMembership | None) -> None:
    if pick_task.assigned_membership is None or membership is None:
        return
    if pick_task.assigned_membership_id != membership.id:
        raise ValidationError({"assigned_membership": "Pick task is assigned to a different membership."})


@transaction.atomic
def complete_pick_task(
    pick_task: PickTask,
    *,
    operator_name: str,
    membership: OrganizationMembership | None = None,
    to_location: Location | None = None,
) -> PickTask:
    task = PickTask.objects.select_for_update(of=("self",)).select_related(
        "sales_order_line",
        "sales_order_line__sales_order",
        "sales_order_line__product",
        "from_location",
        "to_location",
    ).get(pk=pick_task.pk)
    if task.status == PickTaskStatus.COMPLETED:
        raise ValidationError({"status": "Pick task is already completed."})
    if task.status == PickTaskStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled pick tasks cannot be completed."})
    _ensure_execution_access(task, membership)

    destination = to_location or task.to_location
    if destination.organization_id != task.organization_id or destination.warehouse_id != task.warehouse_id:
        raise ValidationError({"to_location": "Destination location must belong to the same warehouse as the pick task."})

    source_balance = InventoryBalance.objects.select_for_update().get(
        organization=task.organization,
        warehouse=task.warehouse,
        location=task.from_location,
        product=task.sales_order_line.product,
        stock_status=task.stock_status,
        lot_number=task.lot_number,
        serial_number=task.serial_number,
    )
    if source_balance.allocated_qty < task.quantity:
        raise ValidationError({"quantity": "Allocated inventory is insufficient for the pick task."})
    source_balance.allocated_qty -= task.quantity
    source_balance.save(update_fields=["allocated_qty"])

    movement = record_inventory_movement(
        CreateInventoryMovementInput(
            organization=task.organization,
            warehouse=task.warehouse,
            product=task.sales_order_line.product,
            movement_type=MovementType.TRANSFER,
            quantity=task.quantity,
            performed_by=operator_name.strip() or "system",
            from_location=task.from_location,
            to_location=destination,
            stock_status=task.stock_status,
            lot_number=task.lot_number,
            serial_number=task.serial_number,
            reference_code=task.sales_order_line.sales_order.order_number,
            reason="OUTBOUND_PICK",
        )
    )

    line = task.sales_order_line
    line.allocated_qty -= task.quantity
    line.picked_qty += task.quantity
    line.status = _line_status(line)
    line.save(update_fields=["allocated_qty", "picked_qty", "status", "update_time"])

    task.to_location = destination
    task.status = PickTaskStatus.COMPLETED
    task.completed_by = operator_name.strip() or "system"
    task.completed_at = timezone.now()
    task.inventory_movement = movement
    task.save(update_fields=["to_location", "status", "completed_by", "completed_at", "inventory_movement", "update_time"])
    refresh_sales_order_status(line.sales_order)
    return task


@transaction.atomic
def create_shipment(
    sales_order: SalesOrder,
    *,
    payload: CreateShipmentInput,
    operator_name: str,
) -> Shipment:
    order = SalesOrder.objects.select_for_update(of=("self",)).select_related("staging_location", "warehouse").get(
        pk=sales_order.pk
    )
    if order.status == SalesOrderStatus.CANCELLED:
        raise ValidationError({"status": "Cancelled sales orders cannot be shipped."})

    shipment = Shipment.objects.create(
        organization=order.organization,
        sales_order=order,
        warehouse=order.warehouse,
        shipment_number=payload.shipment_number,
        tracking_number=order.tracking_number,
        shipped_by=operator_name.strip() or "system",
    )

    shipped_any = False
    for line in order.lines.select_for_update(of=("self",)).select_related("product").all():
        quantity = line.picked_qty - line.shipped_qty
        if quantity <= ZERO:
            continue
        staging_balance = InventoryBalance.objects.select_for_update().get(
            organization=order.organization,
            warehouse=order.warehouse,
            location=order.staging_location,
            product=line.product,
            stock_status=line.stock_status,
        )
        movement = record_inventory_movement(
            CreateInventoryMovementInput(
                organization=order.organization,
                warehouse=order.warehouse,
                product=line.product,
                movement_type=MovementType.SHIP,
                quantity=quantity,
                performed_by=operator_name.strip() or "system",
                from_location=order.staging_location,
                stock_status=line.stock_status,
                lot_number=staging_balance.lot_number,
                serial_number=staging_balance.serial_number,
                reference_code=order.order_number,
                reason="OUTBOUND_SHIP",
            )
        )
        ShipmentLine.objects.create(
            organization=order.organization,
            shipment=shipment,
            sales_order_line=line,
            quantity=quantity,
            inventory_movement=movement,
        )
        line.shipped_qty += quantity
        line.status = _line_status(line)
        line.save(update_fields=["shipped_qty", "status", "update_time"])
        shipped_any = True

    if not shipped_any:
        raise ValidationError({"quantity": "Sales order has no picked quantity available to ship."})

    order.packed_at = order.packed_at or timezone.now()
    refresh_sales_order_status(order)
    return shipment
