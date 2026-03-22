"""Domain services for inbound purchase orders, receipts, and putaway tasks."""

from __future__ import annotations

import csv
import io
from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
from typing import Iterable

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from inventory.models import InventoryStatus, MovementType
from inventory.services import ensure_location_usable, ensure_tenant_match, record_inventory_movement
from locations.models import Location, ZoneUsage
from scanner.models import LicensePlateStatus
from scanner.services import transition_license_plate, upsert_license_plate_receipt
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from utils.scanning import (
    resolve_and_validate_scan_attributes,
    resolve_goods_by_scan_code,
    resolve_license_plate_by_scan_code,
    resolve_location_by_scan_code,
)
from warehouse.models import Warehouse

from .models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    AdvanceShipmentNoticeStatus,
    InboundImportBatch,
    InboundImportBatchStatus,
    InboundSigningRecord,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderLineStatus,
    PurchaseOrderStatus,
    PutawayTask,
    PutawayTaskStatus,
    Receipt,
    ReceiptLine,
)

ZERO = Decimal("0.0000")


@dataclass(frozen=True)
class PurchaseOrderLinePayload:
    line_number: int
    goods: object
    ordered_qty: Decimal
    unit_cost: Decimal
    stock_status: str


@dataclass(frozen=True)
class ReceiptLinePayload:
    purchase_order_line: PurchaseOrderLine
    received_qty: Decimal
    stock_status: str
    lot_number: str
    serial_number: str
    unit_cost: Decimal
    asn_line: AdvanceShipmentNoticeLine | None = None
    license_plate: object | None = None


@dataclass(frozen=True)
class AdvanceShipmentNoticeLinePayload:
    line_number: int
    goods: object
    expected_qty: Decimal
    stock_status: str
    purchase_order_line: PurchaseOrderLine | None = None
    expected_lpn_code: str = ""
    notes: str = ""


@dataclass(frozen=True)
class PutawayTaskUpdatePayload:
    assigned_to: Staff | None
    to_location: Location | None
    status: str
    notes: str


@dataclass(frozen=True)
class ScanReceiptPayload:
    purchase_order_number: str
    asn_number: str
    receipt_number: str
    receipt_location_barcode: str
    goods_barcode: str
    lpn_barcode: str
    attribute_scan: str
    received_qty: Decimal
    stock_status: str
    lot_number: str
    serial_number: str
    unit_cost: Decimal
    reference_code: str
    notes: str
    order_type: str = ""


@dataclass(frozen=True)
class ScanSignPayload:
    purchase_order_number: str
    asn_number: str
    signing_number: str
    carrier_name: str
    vehicle_plate: str
    reference_code: str
    notes: str
    order_type: str = ""


@dataclass(frozen=True)
class ScanPutawayPayload:
    task_number: str
    from_location_barcode: str
    to_location_barcode: str
    goods_barcode: str
    lpn_barcode: str
    order_type: str = ""


def _line_status(*, ordered_qty: Decimal, received_qty: Decimal, current_status: str) -> str:
    if current_status == PurchaseOrderLineStatus.CANCELLED:
        return current_status
    if received_qty <= ZERO:
        return PurchaseOrderLineStatus.OPEN
    if received_qty >= ordered_qty:
        return PurchaseOrderLineStatus.CLOSED
    return PurchaseOrderLineStatus.PARTIAL


def refresh_purchase_order_status(purchase_order: PurchaseOrder) -> PurchaseOrder:
    active_lines = list(purchase_order.lines.filter(is_delete=False))
    if not active_lines:
        purchase_order.status = PurchaseOrderStatus.CANCELLED if purchase_order.status == PurchaseOrderStatus.CANCELLED else PurchaseOrderStatus.OPEN
    elif all(line.status == PurchaseOrderLineStatus.CLOSED for line in active_lines):
        purchase_order.status = PurchaseOrderStatus.CLOSED
    elif any(line.received_qty > ZERO for line in active_lines):
        purchase_order.status = PurchaseOrderStatus.PARTIAL
    elif purchase_order.status != PurchaseOrderStatus.CANCELLED:
        purchase_order.status = PurchaseOrderStatus.OPEN
    purchase_order.save(update_fields=["status", "update_time"])
    return purchase_order


def _asn_line_status(*, expected_qty: Decimal, received_qty: Decimal) -> str:
    if received_qty <= ZERO:
        return AdvanceShipmentNoticeStatus.OPEN
    if received_qty >= expected_qty:
        return AdvanceShipmentNoticeStatus.RECEIVED
    return AdvanceShipmentNoticeStatus.PARTIAL


def refresh_asn_status(asn: AdvanceShipmentNotice) -> AdvanceShipmentNotice:
    active_lines = list(asn.lines.filter(is_delete=False))
    if not active_lines:
        asn.status = AdvanceShipmentNoticeStatus.CANCELLED if asn.status == AdvanceShipmentNoticeStatus.CANCELLED else AdvanceShipmentNoticeStatus.OPEN
    elif all(line.received_qty >= line.expected_qty for line in active_lines):
        asn.status = AdvanceShipmentNoticeStatus.RECEIVED
    elif any(line.received_qty > ZERO for line in active_lines):
        asn.status = AdvanceShipmentNoticeStatus.PARTIAL
    elif asn.status != AdvanceShipmentNoticeStatus.CANCELLED:
        asn.status = AdvanceShipmentNoticeStatus.OPEN
    asn.save(update_fields=["status", "update_time"])
    return asn


def _validate_receiving_location(location: Location, *, openid: str, warehouse: Warehouse) -> None:
    ensure_tenant_match(location, openid, "Receipt location")
    if location.warehouse_id != warehouse.id:
        raise APIException({"detail": "Receipt location must belong to the selected warehouse"})
    ensure_location_usable(location)
    if location.zone.usage != ZoneUsage.RECEIVING:
        raise APIException({"detail": "Receipt location must belong to a receiving zone"})


def _validate_putaway_destination(location: Location, *, openid: str, warehouse: Warehouse) -> None:
    ensure_tenant_match(location, openid, "Putaway destination")
    if location.warehouse_id != warehouse.id:
        raise APIException({"detail": "Putaway destination must belong to the selected warehouse"})
    ensure_location_usable(location)
    if not location.location_type.putaway_enabled:
        raise APIException({"detail": "Destination location type does not allow putaway"})
    if location.zone.usage == ZoneUsage.RECEIVING:
        raise APIException({"detail": "Putaway destination cannot remain in the receiving zone"})


def _validate_purchase_order_line(
    purchase_order_line: PurchaseOrderLine,
    *,
    openid: str,
    purchase_order: PurchaseOrder,
) -> PurchaseOrderLine:
    ensure_tenant_match(purchase_order_line, openid, "Purchase order line")
    if purchase_order_line.purchase_order_id != purchase_order.id:
        raise APIException({"detail": "Receipt line does not belong to the selected purchase order"})
    if purchase_order_line.status == PurchaseOrderLineStatus.CANCELLED:
        raise APIException({"detail": "Cancelled purchase order lines cannot be received"})
    return purchase_order_line


def _ensure_task_operator(*, task: PutawayTask, operator: Staff) -> None:
    ensure_tenant_match(operator, task.openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})
    if task.assigned_to_id is not None and task.assigned_to_id != operator.id:
        raise APIException({"detail": "This putaway task is assigned to a different operator"})


def _resolve_scanned_inbound_documents(
    *,
    openid: str,
    purchase_order_number: str,
    asn_number: str,
    expected_order_type: str = "",
) -> tuple[AdvanceShipmentNotice | None, PurchaseOrder, Warehouse]:
    if asn_number:
        asn = AdvanceShipmentNotice.objects.select_related("purchase_order", "warehouse").filter(
            openid=openid,
            asn_number=asn_number,
            is_delete=False,
        ).first()
        if asn is None:
            raise APIException({"detail": "Scanned ASN was not found"})
        if expected_order_type and asn.order_type != expected_order_type:
            raise ValidationError({"detail": f"Scanned ASN does not belong to the {expected_order_type} partition"})
        return asn, asn.purchase_order, asn.warehouse

    purchase_order = PurchaseOrder.objects.select_related("warehouse").filter(
        openid=openid,
        po_number=purchase_order_number,
        is_delete=False,
    ).first()
    if purchase_order is None:
        raise APIException({"detail": "Scanned purchase order was not found"})
    if expected_order_type and purchase_order.order_type != expected_order_type:
        raise ValidationError({"detail": f"Scanned purchase order does not belong to the {expected_order_type} partition"})
    return None, purchase_order, purchase_order.warehouse


def _stringify_api_error(error: Exception) -> str:
    if isinstance(error, APIException):
        detail = error.detail
        if isinstance(detail, dict):
            return "; ".join(f"{key}: {value}" for key, value in detail.items())
        return str(detail)
    return str(error)


def _build_import_batch_number() -> str:
    return f"IMP-{timezone.now():%Y%m%d%H%M%S%f}"


def _parse_import_decimal(value: str | None, *, field_name: str, minimum: Decimal) -> Decimal:
    raw_value = (value or "").strip()
    if not raw_value:
        raise APIException({"detail": f"{field_name} is required"})
    try:
        parsed = Decimal(raw_value)
    except InvalidOperation as exc:  # pragma: no cover - guarded by tests that assert message
        raise APIException({"detail": f"{field_name} must be a valid decimal"}) from exc
    if parsed < minimum:
        raise APIException({"detail": f"{field_name} must be at least {minimum}"})
    return parsed


def _read_uploaded_file_text(*, uploaded_file) -> str:
    uploaded_file.seek(0)
    raw_value = uploaded_file.read()
    if isinstance(raw_value, bytes):
        return raw_value.decode("utf-8-sig")
    return str(raw_value)


def _record_receipt_line(
    *,
    openid: str,
    operator_name: str,
    purchase_order: PurchaseOrder,
    receipt: Receipt,
    purchase_order_line: PurchaseOrderLine,
    received_qty: Decimal,
    stock_status: str,
    lot_number: str,
    serial_number: str,
    unit_cost: Decimal,
    asn_line: AdvanceShipmentNoticeLine | None = None,
    license_plate=None,
) -> ReceiptLine:
    purchase_order_line = PurchaseOrderLine.objects.select_for_update().select_related("goods").get(pk=purchase_order_line.pk)
    _validate_purchase_order_line(purchase_order_line, openid=openid, purchase_order=purchase_order)
    remaining_qty = purchase_order_line.ordered_qty - purchase_order_line.received_qty
    if received_qty > remaining_qty:
        raise APIException({"detail": "Received quantity cannot exceed the remaining ordered quantity"})
    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=receipt.warehouse,
        goods=purchase_order_line.goods,
        movement_type=MovementType.RECEIPT,
        quantity=received_qty,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        unit_cost=unit_cost,
        to_location=receipt.receipt_location,
        reference_code=receipt.receipt_number,
        reason=f"Receipt {receipt.receipt_number}",
    )
    receipt_line = ReceiptLine.objects.create(
        asn_line=asn_line,
        receipt=receipt,
        purchase_order_line=purchase_order_line,
        goods=purchase_order_line.goods,
        receipt_location=receipt.receipt_location,
        received_qty=received_qty,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        unit_cost=unit_cost,
        inventory_movement=movement,
        license_plate=license_plate,
        creator=operator_name,
        openid=openid,
    )
    PutawayTask.objects.create(
        receipt_line=receipt_line,
        warehouse=receipt.warehouse,
        goods=receipt_line.goods,
        task_number=f"PUT-{receipt.receipt_number}-{receipt_line.id:04d}",
        from_location=receipt.receipt_location,
        quantity=received_qty,
        stock_status=stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        status=PutawayTaskStatus.OPEN,
        license_plate=license_plate,
        notes="Generated from inbound receipt posting.",
        creator=operator_name,
        openid=openid,
    )
    purchase_order_line.received_qty += received_qty
    purchase_order_line.status = _line_status(
        ordered_qty=purchase_order_line.ordered_qty,
        received_qty=purchase_order_line.received_qty,
        current_status=purchase_order_line.status,
    )
    purchase_order_line.save(update_fields=["received_qty", "status", "update_time"])
    if asn_line is not None:
        asn_line.received_qty += received_qty
        asn_line.save(update_fields=["received_qty", "update_time"])
        refresh_asn_status(asn_line.asn)
    return receipt_line


@transaction.atomic
def create_purchase_order(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    supplier: Supplier,
    order_type: str,
    po_number: str,
    expected_arrival_date,
    reference_code: str,
    notes: str,
    line_items: Iterable[PurchaseOrderLinePayload],
) -> PurchaseOrder:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(supplier, openid, "Supplier")
    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "Purchase orders require at least one line item"})

    purchase_order = PurchaseOrder.objects.create(
        warehouse=warehouse,
        supplier=supplier,
        order_type=order_type,
        po_number=po_number,
        expected_arrival_date=expected_arrival_date,
        reference_code=reference_code,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    used_line_numbers: set[int] = set()
    for payload in line_items:
        if payload.line_number in used_line_numbers:
            raise APIException({"detail": "Purchase order line numbers must be unique"})
        used_line_numbers.add(payload.line_number)
        ensure_tenant_match(payload.goods, openid, "Goods")
        PurchaseOrderLine.objects.create(
            purchase_order=purchase_order,
            line_number=payload.line_number,
            goods=payload.goods,
            ordered_qty=payload.ordered_qty,
            received_qty=ZERO,
            unit_cost=payload.unit_cost,
            stock_status=payload.stock_status,
            creator=operator_name,
            openid=openid,
        )
    return purchase_order


@transaction.atomic
def create_advance_shipment_notice(
    *,
    openid: str,
    operator_name: str,
    purchase_order: PurchaseOrder,
    warehouse: Warehouse,
    supplier: Supplier,
    asn_number: str,
    expected_arrival_date,
    reference_code: str,
    notes: str,
    line_items: Iterable[AdvanceShipmentNoticeLinePayload],
) -> AdvanceShipmentNotice:
    ensure_tenant_match(purchase_order, openid, "Purchase order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(supplier, openid, "Supplier")
    if purchase_order.warehouse_id != warehouse.id or purchase_order.supplier_id != supplier.id:
        raise APIException({"detail": "ASN warehouse and supplier must match the linked purchase order"})
    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "ASNs require at least one line item"})
    asn = AdvanceShipmentNotice.objects.create(
        purchase_order=purchase_order,
        warehouse=warehouse,
        supplier=supplier,
        order_type=purchase_order.order_type,
        asn_number=asn_number,
        expected_arrival_date=expected_arrival_date,
        reference_code=reference_code,
        notes=notes,
        creator=operator_name,
        openid=openid,
    )
    used_line_numbers: set[int] = set()
    for payload in line_items:
        if payload.line_number in used_line_numbers:
            raise APIException({"detail": "ASN line numbers must be unique"})
        used_line_numbers.add(payload.line_number)
        ensure_tenant_match(payload.goods, openid, "Goods")
        if payload.purchase_order_line is not None:
            _validate_purchase_order_line(payload.purchase_order_line, openid=openid, purchase_order=purchase_order)
        AdvanceShipmentNoticeLine.objects.create(
            asn=asn,
            line_number=payload.line_number,
            purchase_order_line=payload.purchase_order_line,
            goods=payload.goods,
            expected_qty=payload.expected_qty,
            stock_status=payload.stock_status,
            expected_lpn_code=payload.expected_lpn_code,
            notes=payload.notes,
            creator=operator_name,
            openid=openid,
        )
    return asn


@transaction.atomic
def update_advance_shipment_notice(
    *,
    openid: str,
    asn: AdvanceShipmentNotice,
    warehouse: Warehouse,
    supplier: Supplier,
    expected_arrival_date,
    reference_code: str,
    notes: str,
    status: str,
) -> AdvanceShipmentNotice:
    ensure_tenant_match(asn, openid, "Advance shipment notice")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(supplier, openid, "Supplier")
    if asn.status == AdvanceShipmentNoticeStatus.RECEIVED:
        raise APIException({"detail": "Received ASNs cannot be edited"})
    if status == AdvanceShipmentNoticeStatus.RECEIVED:
        raise APIException({"detail": "ASNs close automatically when all lines are received"})
    asn.warehouse = warehouse
    asn.supplier = supplier
    asn.expected_arrival_date = expected_arrival_date
    asn.reference_code = reference_code
    asn.notes = notes
    asn.status = status
    asn.save(update_fields=["warehouse", "supplier", "expected_arrival_date", "reference_code", "notes", "status", "update_time"])
    return asn


@transaction.atomic
def update_purchase_order(
    *,
    openid: str,
    purchase_order: PurchaseOrder,
    operator_name: str,
    warehouse: Warehouse,
    supplier: Supplier,
    expected_arrival_date,
    reference_code: str,
    notes: str,
    status: str,
) -> PurchaseOrder:
    ensure_tenant_match(purchase_order, openid, "Purchase order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(supplier, openid, "Supplier")

    if purchase_order.receipts.filter(is_delete=False).exists():
        if warehouse.id != purchase_order.warehouse_id or supplier.id != purchase_order.supplier_id:
            raise APIException({"detail": "Warehouse and supplier cannot change after receipts exist"})
        if status == PurchaseOrderStatus.CANCELLED:
            raise APIException({"detail": "Purchase orders with receipts cannot be cancelled"})

    if status == PurchaseOrderStatus.CLOSED:
        refresh_purchase_order_status(purchase_order)
        if purchase_order.status != PurchaseOrderStatus.CLOSED:
            raise APIException({"detail": "Purchase orders can only close automatically when all lines are received"})
    elif status == PurchaseOrderStatus.CANCELLED:
        if purchase_order.receipts.filter(is_delete=False).exists():
            raise APIException({"detail": "Purchase orders with receipts cannot be cancelled"})
        purchase_order.lines.filter(is_delete=False).update(status=PurchaseOrderLineStatus.CANCELLED, update_time=timezone.now())
        purchase_order.status = PurchaseOrderStatus.CANCELLED
    else:
        purchase_order.status = purchase_order.status if purchase_order.status == PurchaseOrderStatus.CLOSED else status

    purchase_order.warehouse = warehouse
    purchase_order.supplier = supplier
    purchase_order.expected_arrival_date = expected_arrival_date
    purchase_order.reference_code = reference_code
    purchase_order.notes = notes
    purchase_order.creator = purchase_order.creator
    purchase_order.save(
        update_fields=[
            "warehouse",
            "supplier",
            "expected_arrival_date",
            "reference_code",
            "notes",
            "status",
            "update_time",
        ]
    )
    if purchase_order.status != PurchaseOrderStatus.CANCELLED:
        refresh_purchase_order_status(purchase_order)
    return purchase_order


@transaction.atomic
def archive_purchase_order(*, openid: str, purchase_order: PurchaseOrder) -> PurchaseOrder:
    ensure_tenant_match(purchase_order, openid, "Purchase order")
    if purchase_order.receipts.filter(is_delete=False).exists():
        raise APIException({"detail": "Purchase orders with receipts cannot be archived"})
    purchase_order.is_delete = True
    purchase_order.save(update_fields=["is_delete", "update_time"])
    purchase_order.lines.filter(is_delete=False).update(is_delete=True, update_time=timezone.now())
    return purchase_order


@transaction.atomic
def record_receipt(
    *,
    openid: str,
    operator_name: str,
    purchase_order: PurchaseOrder,
    warehouse: Warehouse,
    receipt_location: Location,
    receipt_number: str,
    reference_code: str,
    notes: str,
    line_items: Iterable[ReceiptLinePayload],
) -> Receipt:
    ensure_tenant_match(purchase_order, openid, "Purchase order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    if warehouse.id != purchase_order.warehouse_id:
        raise APIException({"detail": "Receipt warehouse must match the purchase order warehouse"})
    if purchase_order.status in {PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.CLOSED}:
        raise APIException({"detail": "This purchase order is no longer open for receipt"})
    _validate_receiving_location(receipt_location, openid=openid, warehouse=warehouse)

    line_items = list(line_items)
    if not line_items:
        raise APIException({"detail": "Receipts require at least one receipt line"})

    receipt = Receipt.objects.create(
        purchase_order=purchase_order,
        warehouse=warehouse,
        receipt_location=receipt_location,
        receipt_number=receipt_number,
        reference_code=reference_code,
        notes=notes,
        received_by=operator_name,
        creator=operator_name,
        openid=openid,
    )

    for payload in line_items:
        _record_receipt_line(
            openid=openid,
            operator_name=operator_name,
            purchase_order=purchase_order,
            receipt=receipt,
            purchase_order_line=payload.purchase_order_line,
            received_qty=payload.received_qty,
            stock_status=payload.stock_status,
            lot_number=payload.lot_number,
            serial_number=payload.serial_number,
            unit_cost=payload.unit_cost,
            asn_line=payload.asn_line,
            license_plate=payload.license_plate,
        )

    refresh_purchase_order_status(purchase_order)
    return receipt


@transaction.atomic
def record_signing(
    *,
    openid: str,
    operator_name: str,
    purchase_order: PurchaseOrder,
    warehouse: Warehouse,
    signing_number: str,
    asn: AdvanceShipmentNotice | None = None,
    reference_code: str,
    notes: str,
    carrier_name: str,
    vehicle_plate: str,
) -> InboundSigningRecord:
    ensure_tenant_match(purchase_order, openid, "Purchase order")
    ensure_tenant_match(warehouse, openid, "Warehouse")
    if purchase_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Signing warehouse must match the purchase order warehouse"})
    if purchase_order.status in {PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.CLOSED}:
        raise APIException({"detail": "This purchase order is no longer open for signing"})
    if asn is not None:
        ensure_tenant_match(asn, openid, "Advance shipment notice")
        if asn.purchase_order_id != purchase_order.id:
            raise APIException({"detail": "Signing ASN must belong to the selected purchase order"})
        if asn.status == AdvanceShipmentNoticeStatus.CANCELLED:
            raise APIException({"detail": "Cancelled ASNs cannot be signed"})

    return InboundSigningRecord.objects.create(
        asn=asn,
        purchase_order=purchase_order,
        warehouse=warehouse,
        signing_number=signing_number,
        reference_code=reference_code,
        notes=notes,
        carrier_name=carrier_name,
        vehicle_plate=vehicle_plate,
        signed_by=operator_name,
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def scan_sign_inbound(*, openid: str, operator: Staff, payload: ScanSignPayload) -> InboundSigningRecord:
    ensure_tenant_match(operator, openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})

    asn, purchase_order, warehouse = _resolve_scanned_inbound_documents(
        openid=openid,
        purchase_order_number=payload.purchase_order_number,
        asn_number=payload.asn_number,
        expected_order_type=payload.order_type,
    )
    return record_signing(
        openid=openid,
        operator_name=operator.staff_name,
        purchase_order=purchase_order,
        warehouse=warehouse,
        asn=asn,
        signing_number=payload.signing_number,
        reference_code=payload.reference_code,
        notes=payload.notes,
        carrier_name=payload.carrier_name,
        vehicle_plate=payload.vehicle_plate,
    )


def import_stock_in_manifest(*, openid: str, operator: Staff, uploaded_file) -> InboundImportBatch:
    ensure_tenant_match(operator, openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})

    batch = InboundImportBatch.objects.create(
        batch_number=_build_import_batch_number(),
        file_name=getattr(uploaded_file, "name", "stock-in-import.csv"),
        status=InboundImportBatchStatus.PROCESSING,
        imported_by=operator.staff_name,
        creator=operator.staff_name,
        openid=openid,
    )
    failure_rows: list[dict[str, object]] = []

    try:
        csv_text = _read_uploaded_file_text(uploaded_file=uploaded_file)
        reader = csv.DictReader(io.StringIO(csv_text))
        if reader.fieldnames is None:
            raise APIException({"detail": "Import file must include a CSV header row"})

        required_headers = {
            "purchase_order_number",
            "asn_number",
            "receipt_number",
            "receipt_location_barcode",
            "goods_barcode",
            "received_qty",
        }
        normalized_headers = {header.strip() for header in reader.fieldnames if header}
        missing_headers = sorted(required_headers - normalized_headers)
        if missing_headers:
            raise APIException({"detail": f"Import file is missing columns: {', '.join(missing_headers)}"})

        rows = [
            row
            for row in reader
            if any(str(value or "").strip() for value in row.values())
        ]
        batch.total_rows = len(rows)
        if not rows:
            raise APIException({"detail": "Import file does not contain any data rows"})

        for row_number, row in enumerate(rows, start=2):
            try:
                purchase_order_number = str(row.get("purchase_order_number", "")).strip()
                asn_number = str(row.get("asn_number", "")).strip()
                if not purchase_order_number and not asn_number:
                    raise APIException({"detail": "purchase_order_number or asn_number is required"})

                stock_status = str(row.get("stock_status", InventoryStatus.AVAILABLE)).strip().upper() or InventoryStatus.AVAILABLE
                if stock_status not in InventoryStatus.values:
                    raise APIException({"detail": f"Unsupported stock_status '{stock_status}'"})

                payload = ScanReceiptPayload(
                    purchase_order_number=purchase_order_number,
                    asn_number=asn_number,
                    receipt_number=str(row.get("receipt_number", "")).strip(),
                    receipt_location_barcode=str(row.get("receipt_location_barcode", "")).strip(),
                    goods_barcode=str(row.get("goods_barcode", "")).strip(),
                    lpn_barcode=str(row.get("lpn_barcode", "")).strip(),
                    attribute_scan=str(row.get("attribute_scan", "")).strip(),
                    received_qty=_parse_import_decimal(row.get("received_qty"), field_name="received_qty", minimum=Decimal("0.0001")),
                    stock_status=stock_status,
                    lot_number=str(row.get("lot_number", "")).strip(),
                    serial_number=str(row.get("serial_number", "")).strip(),
                    unit_cost=_parse_import_decimal(row.get("unit_cost", "0"), field_name="unit_cost", minimum=Decimal("0.0000")),
                    reference_code=str(row.get("reference_code", batch.batch_number)).strip() or batch.batch_number,
                    notes=str(row.get("notes", "")).strip(),
                )
                _, _, warehouse = _resolve_scanned_inbound_documents(
                    openid=openid,
                    purchase_order_number=payload.purchase_order_number,
                    asn_number=payload.asn_number,
                    expected_order_type=payload.order_type,
                )
                scan_receive_goods(
                    openid=openid,
                    operator=operator,
                    warehouse=warehouse,
                    payload=payload,
                )
                batch.success_rows += 1
            except Exception as error:
                batch.failed_rows += 1
                failure_rows.append(
                    {
                        "row_number": row_number,
                        "receipt_number": str(row.get("receipt_number", "")).strip(),
                        "message": _stringify_api_error(error),
                    }
                )

        batch.failure_rows = failure_rows
        if batch.failed_rows == 0:
            batch.status = InboundImportBatchStatus.COMPLETED
        elif batch.success_rows == 0:
            batch.status = InboundImportBatchStatus.FAILED
        else:
            batch.status = InboundImportBatchStatus.COMPLETED_WITH_ERRORS
        batch.summary = f"Imported {batch.success_rows} of {batch.total_rows} rows."
    except Exception as error:
        batch.status = InboundImportBatchStatus.FAILED
        batch.summary = _stringify_api_error(error)
        batch.failure_rows = failure_rows or [{"row_number": 1, "message": batch.summary}]

    batch.save(
        update_fields=[
            "status",
            "total_rows",
            "success_rows",
            "failed_rows",
            "summary",
            "failure_rows",
            "update_time",
        ]
    )
    return batch


@transaction.atomic
def update_putaway_task(
    *,
    openid: str,
    putaway_task: PutawayTask,
    payload: PutawayTaskUpdatePayload,
) -> PutawayTask:
    ensure_tenant_match(putaway_task, openid, "Putaway task")
    if putaway_task.status == PutawayTaskStatus.COMPLETED:
        raise APIException({"detail": "Completed putaway tasks are immutable"})
    if payload.assigned_to is not None:
        ensure_tenant_match(payload.assigned_to, openid, "Assigned staff")
    if payload.to_location is not None:
        _validate_putaway_destination(payload.to_location, openid=openid, warehouse=putaway_task.warehouse)
    if payload.status == PutawayTaskStatus.COMPLETED:
        raise APIException({"detail": "Use the complete endpoint to finish putaway tasks"})
    if payload.status == PutawayTaskStatus.ASSIGNED and payload.assigned_to is None and putaway_task.assigned_to is None:
        raise APIException({"detail": "Assigned tasks require an assignee"})

    putaway_task.assigned_to = payload.assigned_to
    putaway_task.to_location = payload.to_location
    putaway_task.notes = payload.notes
    putaway_task.status = payload.status
    putaway_task.save(update_fields=["assigned_to", "to_location", "notes", "status", "update_time"])
    return putaway_task


@transaction.atomic
def complete_putaway_task(
    *,
    openid: str,
    operator_name: str,
    putaway_task: PutawayTask,
    to_location: Location | None,
) -> PutawayTask:
    ensure_tenant_match(putaway_task, openid, "Putaway task")
    putaway_task = PutawayTask.objects.select_for_update().select_related(
        "warehouse",
        "goods",
        "from_location",
        "receipt_line",
        "license_plate",
    ).get(pk=putaway_task.pk)
    if putaway_task.status == PutawayTaskStatus.COMPLETED:
        return putaway_task
    if putaway_task.status == PutawayTaskStatus.CANCELLED:
        raise APIException({"detail": "Cancelled putaway tasks cannot be completed"})

    destination = to_location or putaway_task.to_location
    if destination is None:
        raise APIException({"detail": "Putaway completion requires a destination location"})
    _validate_putaway_destination(destination, openid=openid, warehouse=putaway_task.warehouse)

    movement = record_inventory_movement(
        openid=openid,
        operator_name=operator_name,
        warehouse=putaway_task.warehouse,
        goods=putaway_task.goods,
        movement_type=MovementType.PUTAWAY,
        quantity=putaway_task.quantity,
        stock_status=putaway_task.stock_status,
        lot_number=putaway_task.lot_number,
        serial_number=putaway_task.serial_number,
        unit_cost=putaway_task.receipt_line.unit_cost,
        from_location=putaway_task.from_location,
        to_location=destination,
        reference_code=putaway_task.task_number,
        reason="Inbound putaway completion",
    )
    putaway_task.to_location = destination
    putaway_task.status = PutawayTaskStatus.COMPLETED
    putaway_task.completed_by = operator_name
    putaway_task.completed_at = timezone.now()
    putaway_task.inventory_movement = movement
    if putaway_task.license_plate_id:
        transition_license_plate(
            openid=openid,
            license_plate=putaway_task.license_plate,
            location=destination,
            status=LicensePlateStatus.STORED,
            reference_code=putaway_task.task_number,
            notes="Inbound putaway completed from scan-first workflow",
        )
    putaway_task.save(
        update_fields=[
            "to_location",
            "status",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "update_time",
        ]
    )
    return putaway_task


@transaction.atomic
def scan_receive_goods(
    *,
    openid: str,
    operator: Staff,
    warehouse: Warehouse,
    payload: ScanReceiptPayload,
) -> Receipt:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(operator, openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})

    asn = None
    if payload.asn_number:
        asn = AdvanceShipmentNotice.objects.select_for_update().select_related("purchase_order", "warehouse").get(
            openid=openid,
            asn_number=payload.asn_number,
            is_delete=False,
        )
        if payload.order_type and asn.order_type != payload.order_type:
            raise ValidationError({"detail": f"Scanned ASN does not belong to the {payload.order_type} partition"})
        if asn.warehouse_id != warehouse.id:
            raise APIException({"detail": "Scanned ASN does not belong to the selected warehouse"})
        purchase_order = asn.purchase_order
    else:
        purchase_order = PurchaseOrder.objects.select_for_update().select_related("warehouse").get(
            openid=openid,
            po_number=payload.purchase_order_number,
            is_delete=False,
        )
        if payload.order_type and purchase_order.order_type != payload.order_type:
            raise ValidationError({"detail": f"Scanned purchase order does not belong to the {payload.order_type} partition"})
    if purchase_order.warehouse_id != warehouse.id:
        raise APIException({"detail": "Scanned purchase order does not belong to the selected warehouse"})
    if purchase_order.status in {PurchaseOrderStatus.CANCELLED, PurchaseOrderStatus.CLOSED}:
        raise APIException({"detail": "This purchase order is no longer open for receipt"})

    receipt_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=warehouse,
        scan_code=payload.receipt_location_barcode,
    )
    _validate_receiving_location(receipt_location, openid=openid, warehouse=warehouse)
    goods = resolve_goods_by_scan_code(openid=openid, scan_code=payload.goods_barcode)
    lot_number, serial_number = resolve_and_validate_scan_attributes(
        openid=openid,
        goods=goods,
        lot_number=payload.lot_number,
        serial_number=payload.serial_number,
        attribute_scan=payload.attribute_scan,
    )

    asn_line = None
    if asn is not None:
        asn_line = (
            asn.lines.select_for_update()
            .filter(goods=goods, is_delete=False)
            .order_by("line_number", "id")
            .first()
        )
        if asn_line is None:
            raise APIException({"detail": "No ASN line matched the scanned goods"})
        remaining_asn_qty = asn_line.expected_qty - asn_line.received_qty
        if payload.received_qty > remaining_asn_qty:
            raise APIException({"detail": "Received quantity cannot exceed the remaining ASN quantity"})
        if asn_line.expected_lpn_code and payload.lpn_barcode and asn_line.expected_lpn_code != payload.lpn_barcode:
            raise APIException({"detail": "Scanned LPN does not match the ASN expectation"})

    purchase_order_line = (
        purchase_order.lines.select_for_update()
        .filter(
            goods=goods,
            is_delete=False,
            status__in=[PurchaseOrderLineStatus.OPEN, PurchaseOrderLineStatus.PARTIAL],
        )
        .order_by("line_number", "id")
        .first()
    )
    if purchase_order_line is None:
        raise APIException({"detail": "No open purchase order line matched the scanned goods"})

    receipt, created = Receipt.objects.select_for_update().get_or_create(
        openid=openid,
        receipt_number=payload.receipt_number,
        is_delete=False,
        defaults={
            "asn": asn,
            "purchase_order": purchase_order,
            "warehouse": warehouse,
            "receipt_location": receipt_location,
            "reference_code": payload.reference_code,
            "notes": payload.notes,
            "received_by": operator.staff_name,
            "creator": operator.staff_name,
        },
    )
    if not created:
        if receipt.purchase_order_id != purchase_order.id or receipt.warehouse_id != warehouse.id:
            raise APIException({"detail": "Existing receipt number belongs to a different purchase order or warehouse"})
        if asn is not None and receipt.asn_id != asn.id:
            raise APIException({"detail": "Existing receipt number belongs to a different ASN"})
        if receipt.receipt_location_id != receipt_location.id:
            raise APIException({"detail": "Scanned receipt location must match the existing receipt header"})

    license_plate = None
    if payload.lpn_barcode:
        license_plate = upsert_license_plate_receipt(
            openid=openid,
            operator_name=operator.staff_name,
            warehouse=warehouse,
            goods=goods,
            lpn_code=payload.lpn_barcode,
            quantity=payload.received_qty,
            location=receipt_location,
            lot_number=lot_number,
            serial_number=serial_number,
            reference_code=payload.receipt_number,
            notes=payload.notes,
        )

    _record_receipt_line(
        openid=openid,
        operator_name=operator.staff_name,
        purchase_order=purchase_order,
        receipt=receipt,
        purchase_order_line=purchase_order_line,
        received_qty=payload.received_qty,
        stock_status=payload.stock_status,
        lot_number=lot_number,
        serial_number=serial_number,
        unit_cost=payload.unit_cost,
        asn_line=asn_line,
        license_plate=license_plate,
    )
    refresh_purchase_order_status(purchase_order)
    if asn is not None:
        refresh_asn_status(asn)
    return receipt


@transaction.atomic
def scan_complete_putaway_task(*, openid: str, operator: Staff, payload: ScanPutawayPayload) -> PutawayTask:
    ensure_tenant_match(operator, openid, "Operator")
    task = PutawayTask.objects.select_for_update().select_related(
        "warehouse",
        "from_location",
        "goods",
        "assigned_to",
        "license_plate",
        "receipt_line__receipt__purchase_order",
    ).get(
        openid=openid,
        task_number=payload.task_number,
        is_delete=False,
    )
    if payload.order_type and task.receipt_line.receipt.purchase_order.order_type != payload.order_type:
        raise ValidationError({"detail": f"Scanned putaway task does not belong to the {payload.order_type} partition"})
    _ensure_task_operator(task=task, operator=operator)

    from_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=task.warehouse,
        scan_code=payload.from_location_barcode,
    )
    if from_location.id != task.from_location_id:
        raise APIException({"detail": "Scanned source location does not match the putaway task"})
    goods = resolve_goods_by_scan_code(openid=openid, scan_code=payload.goods_barcode)
    if goods.id != task.goods_id:
        raise APIException({"detail": "Scanned goods do not match the putaway task"})
    if payload.lpn_barcode:
        license_plate = resolve_license_plate_by_scan_code(
            openid=openid,
            warehouse=task.warehouse,
            scan_code=payload.lpn_barcode,
        )
        if task.license_plate_id is None or task.license_plate_id != license_plate.id:
            raise APIException({"detail": "Scanned LPN does not match the putaway task"})
    to_location = resolve_location_by_scan_code(
        openid=openid,
        warehouse=task.warehouse,
        scan_code=payload.to_location_barcode,
    )
    return complete_putaway_task(
        openid=openid,
        operator_name=operator.staff_name,
        putaway_task=task,
        to_location=to_location,
    )
