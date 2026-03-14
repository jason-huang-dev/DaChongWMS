"""Domain services for ERP sync jobs, carrier bookings, and webhook intake."""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.services import ensure_tenant_match

from .models import (
    CarrierBooking,
    CarrierBookingStatus,
    IntegrationDirection,
    IntegrationJob,
    IntegrationJobStatus,
    IntegrationJobType,
    IntegrationLog,
    IntegrationLogLevel,
    IntegrationSystemType,
    WebhookEvent,
    WebhookEventStatus,
)


@dataclass(frozen=True)
class IntegrationJobCreatePayload:
    warehouse: object | None
    source_webhook: WebhookEvent | None
    system_type: str
    integration_name: str
    job_type: str
    direction: str
    reference_code: str
    external_reference: str
    request_payload: dict[str, object]


@dataclass(frozen=True)
class WebhookIntakePayload:
    warehouse: object | None
    system_type: str
    source_system: str
    event_type: str
    event_key: str
    signature: str
    headers: dict[str, object]
    payload: dict[str, object]
    reference_code: str


@dataclass(frozen=True)
class CarrierBookingPayload:
    warehouse: object
    shipment: object | None
    booking_number: str
    carrier_code: str
    service_level: str
    package_count: int
    total_weight: Decimal
    external_reference: str
    request_payload: dict[str, object]


@dataclass(frozen=True)
class CarrierLabelPayload:
    label_format: str


@transaction.atomic
def append_integration_log(
    *,
    openid: str,
    operator_name: str,
    message: str,
    level: str = IntegrationLogLevel.INFO,
    job: IntegrationJob | None = None,
    webhook_event: WebhookEvent | None = None,
    payload: dict[str, object] | None = None,
) -> IntegrationLog:
    return IntegrationLog.objects.create(
        job=job,
        webhook_event=webhook_event,
        level=level,
        message=message,
        payload=payload or {},
        creator=operator_name,
        openid=openid,
    )


@transaction.atomic
def create_integration_job(*, openid: str, operator_name: str, payload: IntegrationJobCreatePayload) -> IntegrationJob:
    if payload.warehouse is not None:
        ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.source_webhook is not None:
        ensure_tenant_match(payload.source_webhook, openid, "Webhook event")
    job = IntegrationJob.objects.create(
        warehouse=payload.warehouse,
        source_webhook=payload.source_webhook,
        system_type=payload.system_type,
        integration_name=payload.integration_name,
        job_type=payload.job_type,
        direction=payload.direction,
        reference_code=payload.reference_code,
        external_reference=payload.external_reference,
        request_payload=payload.request_payload,
        triggered_by=operator_name,
        creator=operator_name,
        openid=openid,
    )
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=job,
        webhook_event=payload.source_webhook,
        message="Integration job queued",
        payload={"job_type": payload.job_type, "integration_name": payload.integration_name},
    )
    from automation.services import enqueue_integration_job_task

    enqueue_integration_job_task(openid=openid, operator_name=operator_name, integration_job=job)
    return job


@transaction.atomic
def start_integration_job(*, openid: str, operator_name: str, job: IntegrationJob) -> IntegrationJob:
    ensure_tenant_match(job, openid, "Integration job")
    locked_job = IntegrationJob.objects.select_for_update().get(pk=job.pk)
    if locked_job.status in {IntegrationJobStatus.SUCCEEDED, IntegrationJobStatus.CANCELLED}:
        raise ValidationError({"detail": "This integration job can no longer be started"})
    if locked_job.status != IntegrationJobStatus.RUNNING:
        locked_job.status = IntegrationJobStatus.RUNNING
        locked_job.attempt_count += 1
        locked_job.started_at = locked_job.started_at or timezone.now()
        locked_job.last_error = ""
        locked_job.triggered_by = operator_name
        locked_job.save(update_fields=["status", "attempt_count", "started_at", "last_error", "triggered_by", "update_time"])
        append_integration_log(openid=openid, operator_name=operator_name, job=locked_job, message="Integration job started")
    return locked_job


@transaction.atomic
def complete_integration_job(
    *,
    openid: str,
    operator_name: str,
    job: IntegrationJob,
    response_payload: dict[str, object] | None = None,
) -> IntegrationJob:
    ensure_tenant_match(job, openid, "Integration job")
    locked_job = IntegrationJob.objects.select_for_update().get(pk=job.pk)
    if locked_job.status == IntegrationJobStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled integration jobs cannot be completed"})
    if locked_job.started_at is None:
        locked_job.started_at = timezone.now()
        locked_job.attempt_count += 1
    locked_job.status = IntegrationJobStatus.SUCCEEDED
    locked_job.completed_at = timezone.now()
    locked_job.last_error = ""
    locked_job.triggered_by = operator_name
    locked_job.response_payload = response_payload or {}
    locked_job.save(
        update_fields=[
            "status",
            "started_at",
            "completed_at",
            "attempt_count",
            "last_error",
            "triggered_by",
            "response_payload",
            "update_time",
        ]
    )
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=locked_job,
        message="Integration job completed",
        payload=locked_job.response_payload,
    )
    return locked_job


@transaction.atomic
def fail_integration_job(
    *,
    openid: str,
    operator_name: str,
    job: IntegrationJob,
    error_message: str,
    response_payload: dict[str, object] | None = None,
) -> IntegrationJob:
    ensure_tenant_match(job, openid, "Integration job")
    locked_job = IntegrationJob.objects.select_for_update().get(pk=job.pk)
    if locked_job.status == IntegrationJobStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled integration jobs cannot be failed"})
    if locked_job.started_at is None:
        locked_job.started_at = timezone.now()
        locked_job.attempt_count += 1
    locked_job.status = IntegrationJobStatus.FAILED
    locked_job.completed_at = timezone.now()
    locked_job.last_error = error_message
    locked_job.triggered_by = operator_name
    locked_job.response_payload = response_payload or {}
    locked_job.save(
        update_fields=[
            "status",
            "started_at",
            "completed_at",
            "attempt_count",
            "last_error",
            "triggered_by",
            "response_payload",
            "update_time",
        ]
    )
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=locked_job,
        level=IntegrationLogLevel.ERROR,
        message="Integration job failed",
        payload={"error": error_message, **locked_job.response_payload},
    )
    if locked_job.source_webhook_id:
        WebhookEvent.objects.filter(pk=locked_job.source_webhook_id).update(
            status=WebhookEventStatus.FAILED,
            last_error=error_message,
            update_time=timezone.now(),
        )
    if locked_job.job_type == IntegrationJobType.CARRIER_BOOKING:
        CarrierBooking.objects.filter(booking_job=locked_job, is_delete=False).update(
            status=CarrierBookingStatus.FAILED,
            last_error=error_message,
            update_time=timezone.now(),
        )
    elif locked_job.job_type == IntegrationJobType.LABEL_GENERATION:
        CarrierBooking.objects.filter(label_job=locked_job, is_delete=False).update(
            status=CarrierBookingStatus.FAILED,
            last_error=error_message,
            update_time=timezone.now(),
        )
    return locked_job


@transaction.atomic
def intake_webhook(*, openid: str, operator_name: str, payload: WebhookIntakePayload) -> WebhookEvent:
    if payload.warehouse is not None:
        ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    webhook_event, created = WebhookEvent.objects.get_or_create(
        openid=openid,
        source_system=payload.source_system,
        event_key=payload.event_key,
        is_delete=False,
        defaults={
            "warehouse": payload.warehouse,
            "system_type": payload.system_type,
            "event_type": payload.event_type,
            "signature": payload.signature,
            "headers": payload.headers,
            "payload": payload.payload,
            "reference_code": payload.reference_code,
            "status": WebhookEventStatus.RECEIVED,
            "creator": operator_name,
        },
    )
    if not created:
        append_integration_log(
            openid=openid,
            operator_name=operator_name,
            webhook_event=webhook_event,
            level=IntegrationLogLevel.WARNING,
            message="Duplicate webhook received",
            payload={"event_key": webhook_event.event_key},
        )
        return webhook_event

    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        webhook_event=webhook_event,
        message="Webhook received",
        payload={"event_type": payload.event_type, "source_system": payload.source_system},
    )
    queued_job = create_integration_job(
        openid=openid,
        operator_name=operator_name,
        payload=IntegrationJobCreatePayload(
            warehouse=payload.warehouse,
            source_webhook=webhook_event,
            system_type=payload.system_type,
            integration_name=payload.source_system,
            job_type=IntegrationJobType.WEBHOOK_PROCESSING,
            direction=IntegrationDirection.IMPORT,
            reference_code=payload.reference_code,
            external_reference=payload.event_key,
            request_payload=payload.payload,
        ),
    )
    webhook_event.status = WebhookEventStatus.QUEUED
    webhook_event.save(update_fields=["status", "update_time"])
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=queued_job,
        webhook_event=webhook_event,
        message="Webhook queued for processing",
    )
    return webhook_event


@transaction.atomic
def process_webhook_event(
    *,
    openid: str,
    operator_name: str,
    webhook_event: WebhookEvent,
    response_payload: dict[str, object] | None = None,
) -> WebhookEvent:
    ensure_tenant_match(webhook_event, openid, "Webhook event")
    event = WebhookEvent.objects.select_for_update().get(pk=webhook_event.pk)
    if event.status == WebhookEventStatus.PROCESSED:
        return event
    if event.status == WebhookEventStatus.IGNORED:
        raise ValidationError({"detail": "Ignored webhook events cannot be processed"})
    job = event.integration_jobs.order_by("-id").first()
    if job is None:
        job = create_integration_job(
            openid=openid,
            operator_name=operator_name,
            payload=IntegrationJobCreatePayload(
                warehouse=event.warehouse,
                source_webhook=event,
                system_type=event.system_type,
                integration_name=event.source_system,
                job_type=IntegrationJobType.WEBHOOK_PROCESSING,
                direction=IntegrationDirection.IMPORT,
                reference_code=event.reference_code,
                external_reference=event.event_key,
                request_payload=event.payload,
            ),
        )
    start_integration_job(openid=openid, operator_name=operator_name, job=job)
    complete_integration_job(openid=openid, operator_name=operator_name, job=job, response_payload=response_payload or {"processed": True})
    event.status = WebhookEventStatus.PROCESSED
    event.processed_at = timezone.now()
    event.last_error = ""
    event.save(update_fields=["status", "processed_at", "last_error", "update_time"])
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=job,
        webhook_event=event,
        message="Webhook processed",
        payload=response_payload or {"processed": True},
    )
    return event


@transaction.atomic
def execute_integration_job(*, openid: str, operator_name: str, job: IntegrationJob) -> dict[str, object]:
    ensure_tenant_match(job, openid, "Integration job")
    locked_job = IntegrationJob.objects.select_for_update().select_related("source_webhook", "warehouse").get(pk=job.pk)
    if locked_job.request_payload.get("force_fail"):
        raise ValidationError({"detail": "Simulated integration failure"})

    if locked_job.job_type == IntegrationJobType.WEBHOOK_PROCESSING:
        if locked_job.source_webhook is None:
            raise ValidationError({"detail": "Webhook processing jobs require a source webhook"})
        webhook_event = locked_job.source_webhook
        webhook_event.status = WebhookEventStatus.PROCESSED
        webhook_event.processed_at = timezone.now()
        webhook_event.last_error = ""
        webhook_event.save(update_fields=["status", "processed_at", "last_error", "update_time"])
        append_integration_log(
            openid=openid,
            operator_name=operator_name,
            job=locked_job,
            webhook_event=webhook_event,
            message="Webhook processed by background worker",
            payload={"event_key": webhook_event.event_key},
        )
        return {"processed": True, "event_key": webhook_event.event_key}

    if locked_job.job_type == IntegrationJobType.CARRIER_BOOKING:
        booking = CarrierBooking.objects.select_for_update().get(booking_job=locked_job, openid=openid, is_delete=False)
        response_payload = {
            "carrier_code": booking.carrier_code,
            "service_level": booking.service_level,
            "booked": True,
        }
        booking.status = CarrierBookingStatus.BOOKED
        booking.booked_by = operator_name
        booking.booked_at = timezone.now()
        booking.response_payload = response_payload
        booking.last_error = ""
        booking.save(update_fields=["status", "booked_by", "booked_at", "response_payload", "last_error", "update_time"])
        append_integration_log(
            openid=openid,
            operator_name=operator_name,
            job=locked_job,
            message="Carrier booking completed by background worker",
            payload={"booking_number": booking.booking_number},
        )
        return response_payload

    if locked_job.job_type == IntegrationJobType.LABEL_GENERATION:
        booking = CarrierBooking.objects.select_for_update().get(label_job=locked_job, openid=openid, is_delete=False)
        if booking.status not in {CarrierBookingStatus.BOOKED, CarrierBookingStatus.LABELED}:
            raise ValidationError({"detail": "Carrier labels can only be generated after booking is completed"})
        label_format = str(locked_job.request_payload.get("label_format", "PDF"))
        tracking_number = booking.tracking_number or f"TRK-{booking.id:06d}"
        label_document = (
            f"LABEL|FORMAT={label_format}|BOOKING={booking.booking_number}|TRACKING={tracking_number}|"
            f"CARRIER={booking.carrier_code}"
        )
        response_payload = {
            "tracking_number": tracking_number,
            "label_format": label_format,
            "label_generated": True,
        }
        booking.status = CarrierBookingStatus.LABELED
        booking.tracking_number = tracking_number
        booking.label_format = label_format
        booking.label_document = label_document
        booking.response_payload = {**booking.response_payload, **response_payload}
        booking.labeled_at = timezone.now()
        booking.last_error = ""
        booking.save(
            update_fields=[
                "status",
                "tracking_number",
                "label_format",
                "label_document",
                "response_payload",
                "labeled_at",
                "last_error",
                "update_time",
            ]
        )
        append_integration_log(
            openid=openid,
            operator_name=operator_name,
            job=locked_job,
            message="Carrier label generated by background worker",
            payload=response_payload,
        )
        return response_payload

    response_payload = {
        "processed": True,
        "job_type": locked_job.job_type,
        "integration_name": locked_job.integration_name,
    }
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=locked_job,
        message="Integration job completed by background worker",
        payload=response_payload,
    )
    return response_payload


@transaction.atomic
def create_carrier_booking(*, openid: str, operator_name: str, payload: CarrierBookingPayload) -> CarrierBooking:
    ensure_tenant_match(payload.warehouse, openid, "Warehouse")
    if payload.shipment is not None:
        ensure_tenant_match(payload.shipment, openid, "Shipment")
        if payload.shipment.warehouse_id != payload.warehouse.id:
            raise ValidationError({"detail": "Shipment warehouse must match the selected carrier booking warehouse"})
    job = create_integration_job(
        openid=openid,
        operator_name=operator_name,
        payload=IntegrationJobCreatePayload(
            warehouse=payload.warehouse,
            source_webhook=None,
            system_type=IntegrationSystemType.CARRIER,
            integration_name=payload.carrier_code,
            job_type=IntegrationJobType.CARRIER_BOOKING,
            direction=IntegrationDirection.EXPORT,
            reference_code=payload.booking_number,
            external_reference=payload.external_reference,
            request_payload=payload.request_payload,
        ),
    )
    booking = CarrierBooking.objects.create(
        warehouse=payload.warehouse,
        shipment=payload.shipment,
        booking_job=job,
        booking_number=payload.booking_number,
        carrier_code=payload.carrier_code,
        service_level=payload.service_level,
        package_count=payload.package_count,
        total_weight=payload.total_weight,
        status=CarrierBookingStatus.OPEN,
        external_reference=payload.external_reference,
        request_payload=payload.request_payload,
        response_payload={},
        creator=operator_name,
        openid=openid,
    )
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=job,
        message="Carrier booking created",
        payload={"booking_number": booking.booking_number, "carrier_code": booking.carrier_code},
    )
    return booking


@transaction.atomic
def generate_carrier_label(
    *,
    openid: str,
    operator_name: str,
    carrier_booking: CarrierBooking,
    payload: CarrierLabelPayload,
) -> CarrierBooking:
    ensure_tenant_match(carrier_booking, openid, "Carrier booking")
    booking = CarrierBooking.objects.select_for_update().select_related("warehouse", "shipment").get(pk=carrier_booking.pk)
    if booking.status == CarrierBookingStatus.CANCELLED:
        raise ValidationError({"detail": "Cancelled carrier bookings cannot generate labels"})
    if booking.status not in {CarrierBookingStatus.BOOKED, CarrierBookingStatus.LABELED}:
        raise ValidationError({"detail": "Carrier labels require a completed carrier booking"})
    job = create_integration_job(
        openid=openid,
        operator_name=operator_name,
        payload=IntegrationJobCreatePayload(
            warehouse=booking.warehouse,
            source_webhook=None,
            system_type=IntegrationSystemType.CARRIER,
            integration_name=booking.carrier_code,
            job_type=IntegrationJobType.LABEL_GENERATION,
            direction=IntegrationDirection.EXPORT,
            reference_code=booking.booking_number,
            external_reference=booking.external_reference,
            request_payload={"label_format": payload.label_format},
        ),
    )
    booking.label_job = job
    booking.last_error = ""
    booking.save(update_fields=["label_job", "last_error", "update_time"])
    append_integration_log(
        openid=openid,
        operator_name=operator_name,
        job=job,
        message="Carrier label queued",
        payload={"label_format": payload.label_format},
    )
    return booking
