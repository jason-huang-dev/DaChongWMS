"""Domain helpers for license plates, handheld sessions, and offline replay."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from typing import Any

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import APIException, ValidationError

from inventory.services import ensure_tenant_match
from locations.models import Location
from staff.models import ListModel as Staff
from warehouse.models import Warehouse

from .models import (
    HandheldDeviceSession,
    HandheldDeviceSessionStatus,
    HandheldTelemetrySample,
    LicensePlate,
    LicensePlateStatus,
    OfflineReplayBatch,
    OfflineReplayBatchStatus,
    OfflineReplayConflictRule,
    OfflineReplayConflictType,
    OfflineReplayEvent,
    OfflineReplayEventStatus,
    OfflineReplayEventType,
)


@dataclass(frozen=True)
class DeviceSessionPayload:
    device_id: str
    device_label: str = ""
    app_version: str = ""
    platform: str = ""
    notes: str = ""
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class DeviceSessionHeartbeatPayload:
    app_version: str = ""
    notes: str = ""
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class HandheldTelemetryPayload:
    scan_count: int = 0
    queued_event_count: int = 0
    sync_count: int = 0
    replay_conflict_count: int = 0
    replay_failure_count: int = 0
    battery_level: int | None = None
    network_type: str = ""
    signal_strength: int | None = None
    latency_ms: int | None = None
    storage_free_mb: Decimal | None = None
    metadata: dict[str, Any] | None = None


@dataclass(frozen=True)
class OfflineReplayEventPayload:
    sequence_number: int
    event_type: str
    payload: dict[str, Any]
    notes: str = ""


@dataclass(frozen=True)
class OfflineReplayBatchPayload:
    session: HandheldDeviceSession
    client_batch_id: str
    events: list[OfflineReplayEventPayload]
    notes: str = ""


@dataclass(frozen=True)
class ReplayResolution:
    status: str
    result: object | None = None
    conflict_rule: str = ""
    conflict_type: str = ""
    conflict_key: str = ""
    summary: str = ""


@transaction.atomic
def upsert_license_plate_receipt(
    *,
    openid: str,
    operator_name: str,
    warehouse: Warehouse,
    goods,
    lpn_code: str,
    quantity: Decimal,
    location: Location,
    lot_number: str,
    serial_number: str,
    reference_code: str = "",
    notes: str = "",
) -> LicensePlate:
    ensure_tenant_match(warehouse, openid, "Warehouse")
    ensure_tenant_match(goods, openid, "Goods")
    ensure_tenant_match(location, openid, "Location")
    license_plate, created = LicensePlate.objects.select_for_update().get_or_create(
        openid=openid,
        lpn_code=lpn_code,
        is_delete=False,
        defaults={
            "warehouse": warehouse,
            "goods": goods,
            "current_location": location,
            "quantity": quantity,
            "lot_number": lot_number,
            "serial_number": serial_number,
            "status": LicensePlateStatus.RECEIVED,
            "reference_code": reference_code,
            "notes": notes,
            "creator": operator_name,
        },
    )
    if created:
        return license_plate
    if license_plate.warehouse_id != warehouse.id:
        raise APIException({"detail": f"License plate `{lpn_code}` belongs to a different warehouse"})
    if license_plate.goods_id != goods.id:
        raise APIException({"detail": f"License plate `{lpn_code}` belongs to a different SKU"})
    if license_plate.lot_number and lot_number and license_plate.lot_number != lot_number:
        raise APIException({"detail": f"License plate `{lpn_code}` lot number does not match the scanned lot"})
    if license_plate.serial_number and serial_number and license_plate.serial_number != serial_number:
        raise APIException({"detail": f"License plate `{lpn_code}` serial number does not match the scanned serial"})
    license_plate.quantity += quantity
    license_plate.current_location = location
    license_plate.lot_number = lot_number or license_plate.lot_number
    license_plate.serial_number = serial_number or license_plate.serial_number
    license_plate.status = LicensePlateStatus.RECEIVED
    license_plate.reference_code = reference_code or license_plate.reference_code
    if notes:
        license_plate.notes = notes
    license_plate.save(
        update_fields=[
            "quantity",
            "current_location",
            "lot_number",
            "serial_number",
            "status",
            "reference_code",
            "notes",
            "update_time",
        ]
    )
    return license_plate


@transaction.atomic
def transition_license_plate(
    *,
    openid: str,
    license_plate: LicensePlate,
    location: Location | None,
    status: str,
    reference_code: str = "",
    notes: str = "",
) -> LicensePlate:
    ensure_tenant_match(license_plate, openid, "License plate")
    locked_plate = LicensePlate.objects.select_for_update().get(pk=license_plate.pk)
    if location is not None:
        ensure_tenant_match(location, openid, "Location")
        if locked_plate.warehouse_id != location.warehouse_id:
            raise APIException({"detail": "License plate cannot move across warehouses"})
        locked_plate.current_location = location
    locked_plate.status = status
    if reference_code:
        locked_plate.reference_code = reference_code
    if notes:
        locked_plate.notes = notes
    locked_plate.save(update_fields=["current_location", "status", "reference_code", "notes", "update_time"])
    return locked_plate


@transaction.atomic
def start_handheld_device_session(
    *,
    openid: str,
    operator: Staff,
    payload: DeviceSessionPayload,
) -> HandheldDeviceSession:
    ensure_tenant_match(operator, openid, "Operator")
    if operator.is_lock:
        raise APIException({"detail": "Assigned operator is locked"})
    if not payload.device_id.strip():
        raise ValidationError({"device_id": "device_id is required"})

    now = timezone.now()
    session, created = HandheldDeviceSession.objects.select_for_update().get_or_create(
        openid=openid,
        device_id=payload.device_id,
        status=HandheldDeviceSessionStatus.ACTIVE,
        is_delete=False,
        defaults={
            "operator": operator,
            "device_label": payload.device_label,
            "app_version": payload.app_version,
            "platform": payload.platform,
            "session_started_at": now,
            "last_seen_at": now,
            "notes": payload.notes,
            "metadata": payload.metadata or {},
            "creator": operator.staff_name,
        },
    )
    if created:
        return session

    if session.operator_id != operator.id:
        raise APIException({"detail": f"Device `{payload.device_id}` already has an active session for another operator"})
    session.device_label = payload.device_label or session.device_label
    session.app_version = payload.app_version or session.app_version
    session.platform = payload.platform or session.platform
    session.last_seen_at = now
    if payload.notes:
        session.notes = payload.notes
    if payload.metadata:
        session.metadata = {**session.metadata, **payload.metadata}
    session.save(update_fields=["device_label", "app_version", "platform", "last_seen_at", "notes", "metadata", "update_time"])
    return session


@transaction.atomic
def heartbeat_handheld_device_session(
    *,
    openid: str,
    operator: Staff,
    session: HandheldDeviceSession,
    payload: DeviceSessionHeartbeatPayload,
) -> HandheldDeviceSession:
    ensure_tenant_match(operator, openid, "Operator")
    ensure_tenant_match(session, openid, "Handheld device session")
    locked_session = HandheldDeviceSession.objects.select_for_update().get(pk=session.pk)
    if locked_session.operator_id != operator.id:
        raise APIException({"detail": "Session belongs to a different operator"})
    if locked_session.status != HandheldDeviceSessionStatus.ACTIVE:
        raise APIException({"detail": "Only active handheld sessions can send heartbeats"})
    locked_session.last_seen_at = timezone.now()
    if payload.app_version:
        locked_session.app_version = payload.app_version
    if payload.notes:
        locked_session.notes = payload.notes
    if payload.metadata:
        locked_session.metadata = {**locked_session.metadata, **payload.metadata}
    locked_session.save(update_fields=["last_seen_at", "app_version", "notes", "metadata", "update_time"])
    return locked_session


@transaction.atomic
def record_handheld_telemetry_sample(
    *,
    openid: str,
    operator: Staff,
    session: HandheldDeviceSession,
    payload: HandheldTelemetryPayload,
) -> HandheldTelemetrySample:
    ensure_tenant_match(operator, openid, "Operator")
    ensure_tenant_match(session, openid, "Handheld device session")
    locked_session = HandheldDeviceSession.objects.select_for_update().get(pk=session.pk)
    if locked_session.operator_id != operator.id:
        raise APIException({"detail": "Session belongs to a different operator"})
    if locked_session.status != HandheldDeviceSessionStatus.ACTIVE:
        raise APIException({"detail": "Telemetry can only be recorded for active handheld sessions"})

    sample = HandheldTelemetrySample.objects.create(
        session=locked_session,
        operator=operator,
        scan_count=payload.scan_count,
        queued_event_count=payload.queued_event_count,
        sync_count=payload.sync_count,
        replay_conflict_count=payload.replay_conflict_count,
        replay_failure_count=payload.replay_failure_count,
        battery_level=payload.battery_level,
        network_type=payload.network_type,
        signal_strength=payload.signal_strength,
        latency_ms=payload.latency_ms,
        storage_free_mb=payload.storage_free_mb,
        metadata=payload.metadata or {},
        creator=operator.staff_name,
        openid=openid,
    )
    locked_session.last_seen_at = timezone.now()
    locked_session.telemetry_sample_count += 1
    locked_session.total_scan_count += payload.scan_count
    locked_session.total_sync_count += payload.sync_count
    locked_session.total_conflict_count += payload.replay_conflict_count
    locked_session.total_failure_count += payload.replay_failure_count
    if payload.battery_level is not None:
        locked_session.last_battery_level = payload.battery_level
    if payload.network_type:
        locked_session.last_network_type = payload.network_type
    if payload.signal_strength is not None:
        locked_session.last_signal_strength = payload.signal_strength
    locked_session.save(
        update_fields=[
            "last_seen_at",
            "telemetry_sample_count",
            "total_scan_count",
            "total_sync_count",
            "total_conflict_count",
            "total_failure_count",
            "last_battery_level",
            "last_network_type",
            "last_signal_strength",
            "update_time",
        ]
    )
    return sample


@transaction.atomic
def end_handheld_device_session(
    *,
    openid: str,
    operator: Staff,
    session: HandheldDeviceSession,
    notes: str = "",
) -> HandheldDeviceSession:
    ensure_tenant_match(operator, openid, "Operator")
    ensure_tenant_match(session, openid, "Handheld device session")
    locked_session = HandheldDeviceSession.objects.select_for_update().get(pk=session.pk)
    if locked_session.operator_id != operator.id:
        raise APIException({"detail": "Session belongs to a different operator"})
    if locked_session.status == HandheldDeviceSessionStatus.ENDED:
        return locked_session
    now = timezone.now()
    locked_session.status = HandheldDeviceSessionStatus.ENDED
    locked_session.last_seen_at = now
    locked_session.session_ended_at = now
    if notes:
        locked_session.notes = notes
    locked_session.save(update_fields=["status", "last_seen_at", "session_ended_at", "notes", "update_time"])
    return locked_session


def _resolve_inbound_warehouse(*, openid: str, payload: dict[str, Any]) -> Warehouse:
    from operations.inbound.models import AdvanceShipmentNotice, PurchaseOrder

    asn_number = str(payload.get("asn_number", "")).strip()
    if asn_number:
        asn = AdvanceShipmentNotice.objects.filter(openid=openid, asn_number=asn_number, is_delete=False).select_related("warehouse").first()
        if asn is None:
            raise APIException({"detail": f"Scanned ASN `{asn_number}` was not found"})
        return asn.warehouse

    po_number = str(payload.get("purchase_order_number", "")).strip()
    if not po_number:
        raise ValidationError({"purchase_order_number": "purchase_order_number is required when asn_number is not provided"})
    purchase_order = (
        PurchaseOrder.objects.filter(openid=openid, po_number=po_number, is_delete=False).select_related("warehouse").first()
    )
    if purchase_order is None:
        raise APIException({"detail": f"Scanned purchase order `{po_number}` was not found"})
    return purchase_order.warehouse


def _resolve_outbound_warehouse(*, openid: str, sales_order_number: str) -> Warehouse:
    from operations.outbound.models import SalesOrder

    sales_order = (
        SalesOrder.objects.filter(openid=openid, order_number=sales_order_number, is_delete=False).select_related("warehouse").first()
    )
    if sales_order is None:
        raise APIException({"detail": f"Scanned sales order `{sales_order_number}` was not found"})
    return sales_order.warehouse


def _preflight_inbound_receive(*, openid: str, payload: dict[str, Any]) -> ReplayResolution | None:
    from operations.inbound.models import Receipt

    receipt_number = str(payload.get("receipt_number", "")).strip()
    if not receipt_number:
        return None
    receipt = (
        Receipt.objects.filter(openid=openid, receipt_number=receipt_number, is_delete=False)
        .select_related("purchase_order", "asn", "warehouse", "receipt_location")
        .prefetch_related("lines", "lines__goods")
        .first()
    )
    if receipt is None:
        return None

    expected_order = str(payload.get("purchase_order_number", "")).strip()
    expected_asn = str(payload.get("asn_number", "")).strip()
    if expected_order and receipt.purchase_order.po_number != expected_order:
        return ReplayResolution(
            status=OfflineReplayEventStatus.CONFLICT,
            conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
            conflict_type=OfflineReplayConflictType.DUPLICATE_REFERENCE,
            conflict_key=receipt_number,
            summary="Receipt number already exists for a different purchase order",
        )
    if expected_asn and (receipt.asn is None or receipt.asn.asn_number != expected_asn):
        return ReplayResolution(
            status=OfflineReplayEventStatus.CONFLICT,
            conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
            conflict_type=OfflineReplayConflictType.DUPLICATE_REFERENCE,
            conflict_key=receipt_number,
            summary="Receipt number already exists for a different ASN",
        )

    goods_barcode = str(payload.get("goods_barcode", "")).strip()
    received_qty = Decimal(str(payload.get("received_qty", "0")))
    receipt_location_barcode = str(payload.get("receipt_location_barcode", "")).strip()
    lot_number = str(payload.get("lot_number", "")).strip()
    serial_number = str(payload.get("serial_number", "")).strip()
    matching_line = receipt.lines.filter(
        is_delete=False,
        goods__bar_code=goods_barcode,
        received_qty=received_qty,
        lot_number=lot_number,
        serial_number=serial_number,
    ).first()
    if matching_line is not None and receipt.receipt_location.barcode == receipt_location_barcode:
        return ReplayResolution(
            status=OfflineReplayEventStatus.SKIPPED,
            result=receipt,
            conflict_rule=OfflineReplayConflictRule.IDEMPOTENT_SKIP,
            conflict_type=OfflineReplayConflictType.DUPLICATE_REFERENCE,
            conflict_key=receipt_number,
            summary="Receipt event already applied with the same receipt number and line details",
        )
    return ReplayResolution(
        status=OfflineReplayEventStatus.CONFLICT,
        conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
        conflict_type=OfflineReplayConflictType.STATE_MISMATCH,
        conflict_key=receipt_number,
        summary="Receipt number already exists but the scanned line details do not match the recorded receipt",
    )


def _preflight_inbound_putaway(*, openid: str, payload: dict[str, Any]) -> ReplayResolution | None:
    from operations.inbound.models import PutawayTask, PutawayTaskStatus

    task_number = str(payload.get("task_number", "")).strip()
    if not task_number:
        return None
    task = (
        PutawayTask.objects.filter(openid=openid, task_number=task_number, is_delete=False)
        .select_related("from_location", "to_location", "goods")
        .first()
    )
    if task is None or task.status != PutawayTaskStatus.COMPLETED:
        return None
    if task.from_location.barcode == str(payload.get("from_location_barcode", "")).strip() and task.goods.bar_code == str(
        payload.get("goods_barcode", "")
    ).strip() and task.to_location is not None and task.to_location.barcode == str(payload.get("to_location_barcode", "")).strip():
        return ReplayResolution(
            status=OfflineReplayEventStatus.SKIPPED,
            result=task,
            conflict_rule=OfflineReplayConflictRule.IDEMPOTENT_SKIP,
            conflict_type=OfflineReplayConflictType.TASK_ALREADY_COMPLETED,
            conflict_key=task_number,
            summary="Putaway task is already completed with the same source, destination, and SKU",
        )
    return ReplayResolution(
        status=OfflineReplayEventStatus.CONFLICT,
        conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
        conflict_type=OfflineReplayConflictType.STALE_REFERENCE,
        conflict_key=task_number,
        summary="Putaway task is already completed but the replay payload does not match the completed task state",
    )


def _preflight_outbound_pick(*, openid: str, payload: dict[str, Any]) -> ReplayResolution | None:
    from operations.outbound.models import PickTask, PickTaskStatus

    task_number = str(payload.get("task_number", "")).strip()
    if not task_number:
        return None
    task = (
        PickTask.objects.filter(openid=openid, task_number=task_number, is_delete=False)
        .select_related("from_location", "to_location", "goods")
        .first()
    )
    if task is None or task.status != PickTaskStatus.COMPLETED:
        return None
    if task.from_location.barcode == str(payload.get("from_location_barcode", "")).strip() and task.goods.bar_code == str(
        payload.get("goods_barcode", "")
    ).strip() and task.to_location.barcode == str(payload.get("to_location_barcode", "")).strip():
        return ReplayResolution(
            status=OfflineReplayEventStatus.SKIPPED,
            result=task,
            conflict_rule=OfflineReplayConflictRule.IDEMPOTENT_SKIP,
            conflict_type=OfflineReplayConflictType.TASK_ALREADY_COMPLETED,
            conflict_key=task_number,
            summary="Pick task is already completed with the same source, destination, and SKU",
        )
    return ReplayResolution(
        status=OfflineReplayEventStatus.CONFLICT,
        conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
        conflict_type=OfflineReplayConflictType.STALE_REFERENCE,
        conflict_key=task_number,
        summary="Pick task is already completed but the replay payload does not match the completed task state",
    )


def _preflight_outbound_ship(*, openid: str, payload: dict[str, Any]) -> ReplayResolution | None:
    from operations.outbound.models import Shipment

    shipment_number = str(payload.get("shipment_number", "")).strip()
    if not shipment_number:
        return None
    shipment = (
        Shipment.objects.filter(openid=openid, shipment_number=shipment_number, is_delete=False)
        .select_related("sales_order", "staging_location")
        .prefetch_related("lines", "lines__goods")
        .first()
    )
    if shipment is None:
        return None

    if shipment.sales_order.order_number != str(payload.get("sales_order_number", "")).strip():
        return ReplayResolution(
            status=OfflineReplayEventStatus.CONFLICT,
            conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
            conflict_type=OfflineReplayConflictType.DUPLICATE_REFERENCE,
            conflict_key=shipment_number,
            summary="Shipment number already exists for a different sales order",
        )

    matching_line = shipment.lines.filter(
        is_delete=False,
        goods__bar_code=str(payload.get("goods_barcode", "")).strip(),
        shipped_qty=Decimal(str(payload.get("shipped_qty", "0"))),
        lot_number=str(payload.get("lot_number", "")).strip(),
        serial_number=str(payload.get("serial_number", "")).strip(),
    ).first()
    if matching_line is not None and shipment.staging_location.barcode == str(payload.get("staging_location_barcode", "")).strip():
        return ReplayResolution(
            status=OfflineReplayEventStatus.SKIPPED,
            result=shipment,
            conflict_rule=OfflineReplayConflictRule.IDEMPOTENT_SKIP,
            conflict_type=OfflineReplayConflictType.ORDER_ALREADY_SHIPPED,
            conflict_key=shipment_number,
            summary="Shipment event already applied with the same shipment number and line details",
        )
    return ReplayResolution(
        status=OfflineReplayEventStatus.CONFLICT,
        conflict_rule=OfflineReplayConflictRule.MANUAL_REVIEW,
        conflict_type=OfflineReplayConflictType.STATE_MISMATCH,
        conflict_key=shipment_number,
        summary="Shipment number already exists but the replay payload does not match the recorded shipment",
    )


def _preflight_replay_event(*, openid: str, event_type: str, payload: dict[str, Any]) -> ReplayResolution | None:
    if event_type == OfflineReplayEventType.INBOUND_RECEIVE:
        return _preflight_inbound_receive(openid=openid, payload=payload)
    if event_type == OfflineReplayEventType.INBOUND_PUTAWAY:
        return _preflight_inbound_putaway(openid=openid, payload=payload)
    if event_type == OfflineReplayEventType.OUTBOUND_PICK:
        return _preflight_outbound_pick(openid=openid, payload=payload)
    if event_type == OfflineReplayEventType.OUTBOUND_SHIP:
        return _preflight_outbound_ship(openid=openid, payload=payload)
    return None


@transaction.atomic
def _apply_offline_replay_event(
    *,
    openid: str,
    operator: Staff,
    event_type: str,
    payload: dict[str, Any],
):
    from operations.inbound.serializers import ScanPutawaySerializer, ScanReceiptSerializer
    from operations.inbound.services import ScanPutawayPayload, ScanReceiptPayload, scan_complete_putaway_task, scan_receive_goods
    from operations.outbound.serializers import ScanPickSerializer, ScanShipmentSerializer
    from operations.outbound.services import ScanPickPayload, ScanShipmentPayload, scan_complete_pick_task, scan_ship_sales_order

    if event_type == OfflineReplayEventType.INBOUND_RECEIVE:
        serializer = ScanReceiptSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        warehouse = _resolve_inbound_warehouse(openid=openid, payload=payload)
        return scan_receive_goods(
            openid=openid,
            operator=operator,
            warehouse=warehouse,
            payload=ScanReceiptPayload(**serializer.validated_data),
        )
    if event_type == OfflineReplayEventType.INBOUND_PUTAWAY:
        serializer = ScanPutawaySerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return scan_complete_putaway_task(
            openid=openid,
            operator=operator,
            payload=ScanPutawayPayload(**serializer.validated_data),
        )
    if event_type == OfflineReplayEventType.OUTBOUND_PICK:
        serializer = ScanPickSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        return scan_complete_pick_task(
            openid=openid,
            operator=operator,
            payload=ScanPickPayload(**serializer.validated_data),
        )
    if event_type == OfflineReplayEventType.OUTBOUND_SHIP:
        serializer = ScanShipmentSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        warehouse = _resolve_outbound_warehouse(
            openid=openid,
            sales_order_number=str(serializer.validated_data.get("sales_order_number", "")).strip(),
        )
        return scan_ship_sales_order(
            openid=openid,
            operator=operator,
            warehouse=warehouse,
            payload=ScanShipmentPayload(**serializer.validated_data),
        )
    raise ValidationError({"event_type": f"Unsupported offline replay event type `{event_type}`"})


def _set_batch_status(*, replayed_count: int, conflict_count: int, failed_count: int) -> str:
    if failed_count == 0 and conflict_count == 0:
        return OfflineReplayBatchStatus.COMPLETED
    if failed_count == 0 and conflict_count > 0 and replayed_count == 0:
        return OfflineReplayBatchStatus.CONFLICTED
    if replayed_count == 0:
        return OfflineReplayBatchStatus.FAILED
    return OfflineReplayBatchStatus.PARTIAL


@transaction.atomic
def replay_offline_batch(
    *,
    openid: str,
    operator: Staff,
    payload: OfflineReplayBatchPayload,
) -> OfflineReplayBatch:
    ensure_tenant_match(operator, openid, "Operator")
    ensure_tenant_match(payload.session, openid, "Handheld device session")
    if payload.session.operator_id != operator.id:
        raise APIException({"detail": "Offline replay session belongs to a different operator"})
    if payload.session.status != HandheldDeviceSessionStatus.ACTIVE:
        raise APIException({"detail": "Offline replay requires an active handheld session"})
    if not payload.client_batch_id.strip():
        raise ValidationError({"client_batch_id": "client_batch_id is required"})
    if not payload.events:
        raise ValidationError({"events": "At least one offline replay event is required"})

    batch, created = OfflineReplayBatch.objects.select_for_update().get_or_create(
        openid=openid,
        session=payload.session,
        client_batch_id=payload.client_batch_id,
        is_delete=False,
        defaults={
            "operator": operator,
            "status": OfflineReplayBatchStatus.PENDING,
            "notes": payload.notes,
            "event_count": len(payload.events),
            "creator": operator.staff_name,
        },
    )
    if not created:
        return batch

    batch.status = OfflineReplayBatchStatus.PROCESSING
    batch.save(update_fields=["status", "update_time"])

    replayed_count = 0
    conflict_count = 0
    failed_count = 0
    last_error = ""
    now = timezone.now()

    for event_payload in sorted(payload.events, key=lambda item: item.sequence_number):
        event = OfflineReplayEvent.objects.create(
            batch=batch,
            sequence_number=event_payload.sequence_number,
            event_type=event_payload.event_type,
            payload=event_payload.payload,
            notes=event_payload.notes,
            creator=operator.staff_name,
            openid=openid,
        )
        preflight = _preflight_replay_event(
            openid=openid,
            event_type=event_payload.event_type,
            payload=event_payload.payload,
        )
        if preflight is not None and preflight.status == OfflineReplayEventStatus.SKIPPED:
            event.status = OfflineReplayEventStatus.SKIPPED
            event.processed_at = timezone.now()
            event.result_record_type = preflight.result.__class__.__name__ if preflight.result is not None else ""
            event.result_record_id = getattr(preflight.result, "id", None)
            event.conflict_rule = preflight.conflict_rule
            event.conflict_type = preflight.conflict_type
            event.conflict_key = preflight.conflict_key
            event.result_summary = preflight.summary
            event.save(
                update_fields=[
                    "status",
                    "processed_at",
                    "result_record_type",
                    "result_record_id",
                    "conflict_rule",
                    "conflict_type",
                    "conflict_key",
                    "result_summary",
                    "update_time",
                ]
            )
            continue
        if preflight is not None and preflight.status == OfflineReplayEventStatus.CONFLICT:
            conflict_count += 1
            last_error = preflight.summary
            event.status = OfflineReplayEventStatus.CONFLICT
            event.processed_at = timezone.now()
            event.conflict_rule = preflight.conflict_rule
            event.conflict_type = preflight.conflict_type
            event.conflict_key = preflight.conflict_key
            event.result_summary = preflight.summary
            event.save(
                update_fields=[
                    "status",
                    "processed_at",
                    "conflict_rule",
                    "conflict_type",
                    "conflict_key",
                    "result_summary",
                    "update_time",
                ]
            )
            continue
        try:
            result = _apply_offline_replay_event(
                openid=openid,
                operator=operator,
                event_type=event_payload.event_type,
                payload=event_payload.payload,
            )
        except Exception as exc:  # noqa: BLE001 - retain per-event replay failures in the batch log
            failed_count += 1
            last_error = str(exc)
            event.status = OfflineReplayEventStatus.FAILED
            event.processed_at = timezone.now()
            event.error_message = str(exc)
            event.save(update_fields=["status", "processed_at", "error_message", "update_time"])
            continue

        replayed_count += 1
        event.status = OfflineReplayEventStatus.APPLIED
        event.processed_at = timezone.now()
        event.result_record_type = result.__class__.__name__
        event.result_record_id = getattr(result, "id", None)
        event.result_summary = "Replay event applied successfully"
        event.save(
            update_fields=[
                "status",
                "processed_at",
                "result_record_type",
                "result_record_id",
                "result_summary",
                "update_time",
            ]
        )

    batch.status = _set_batch_status(replayed_count=replayed_count, conflict_count=conflict_count, failed_count=failed_count)
    batch.processed_at = timezone.now()
    batch.event_count = len(payload.events)
    batch.replayed_count = replayed_count
    batch.conflict_count = conflict_count
    batch.failed_count = failed_count
    batch.last_error = last_error
    batch.save(
        update_fields=[
            "status",
            "processed_at",
            "event_count",
            "replayed_count",
            "conflict_count",
            "failed_count",
            "last_error",
            "update_time",
        ]
    )
    payload.session.last_seen_at = now
    payload.session.last_sync_at = now
    payload.session.total_sync_count += 1
    payload.session.total_scan_count += len(payload.events)
    payload.session.total_replayed_count += replayed_count
    payload.session.total_conflict_count += conflict_count
    payload.session.total_failure_count += failed_count
    payload.session.save(
        update_fields=[
            "last_seen_at",
            "last_sync_at",
            "total_sync_count",
            "total_scan_count",
            "total_replayed_count",
            "total_conflict_count",
            "total_failure_count",
            "update_time",
        ]
    )
    return batch
