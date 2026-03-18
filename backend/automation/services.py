"""DB-backed worker and schedule orchestration services."""

from __future__ import annotations

from datetime import date
from datetime import timedelta
from typing import Any

from django.db.models import Count
from django.db import transaction
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from inventory.services import ensure_tenant_match

from .models import (
    AutomationAlert,
    AutomationAlertSeverity,
    AutomationAlertStatus,
    AutomationAlertType,
    BackgroundTask,
    BackgroundTaskStatus,
    BackgroundTaskType,
    ScheduledTask,
    WorkerHeartbeat,
)


@transaction.atomic
def enqueue_background_task(
    *,
    openid: str,
    operator_name: str,
    task_type: str,
    payload: dict[str, Any] | None = None,
    warehouse=None,
    customer=None,
    scheduled_task: ScheduledTask | None = None,
    integration_job=None,
    report_export=None,
    invoice=None,
    reference_code: str = "",
    priority: int = 100,
    max_attempts: int = 3,
    retry_backoff_seconds: int = 60,
    available_at=None,
) -> BackgroundTask:
    if warehouse is not None:
        ensure_tenant_match(warehouse, openid, "Warehouse")
    if customer is not None:
        ensure_tenant_match(customer, openid, "Customer")
    if scheduled_task is not None:
        ensure_tenant_match(scheduled_task, openid, "Scheduled task")
    if integration_job is not None:
        ensure_tenant_match(integration_job, openid, "Integration job")
    if report_export is not None:
        ensure_tenant_match(report_export, openid, "Report export")
    if invoice is not None:
        ensure_tenant_match(invoice, openid, "Invoice")

    task = BackgroundTask.objects.create(
        scheduled_task=scheduled_task,
        warehouse=warehouse,
        customer=customer,
        integration_job=integration_job,
        report_export=report_export,
        invoice=invoice,
        task_type=task_type,
        status=BackgroundTaskStatus.QUEUED,
        priority=priority,
        available_at=available_at or timezone.now(),
        max_attempts=max_attempts,
        retry_backoff_seconds=retry_backoff_seconds,
        reference_code=reference_code,
        payload=payload or {},
        creator=operator_name,
        openid=openid,
    )
    return task


def _parse_iso_date(value: object | None, *, field_name: str) -> date:
    if value is None:
        raise ValidationError({field_name: f"{field_name} is required"})
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:  # pragma: no cover - serializer validation covers normal API cases
        raise ValidationError({field_name: f"{field_name} must be an ISO date"}) from exc


def _build_invoice_number(*, task: BackgroundTask, period_start: date, period_end: date) -> str:
    configured_number = str(task.payload.get("invoice_number", "")).strip()
    if configured_number:
        return configured_number
    prefix = str(task.payload.get("invoice_prefix", "")).strip()
    if not prefix:
        raise ValidationError({"invoice_number": "invoice_number or invoice_prefix is required"})
    return f"{prefix}-{period_start:%Y%m%d}-{period_end:%Y%m%d}"


def _queue_depth(*, now=None) -> int:
    current_time = now or timezone.now()
    return BackgroundTask.objects.filter(
        is_delete=False,
        status__in=[BackgroundTaskStatus.QUEUED, BackgroundTaskStatus.RETRY, BackgroundTaskStatus.RUNNING],
        available_at__lte=current_time,
    ).count()


@transaction.atomic
def record_worker_heartbeat(
    *,
    worker_name: str,
    queue_depth: int,
    processed_count: int = 0,
    last_run_started_at=None,
    last_run_completed_at=None,
    last_error: str = "",
    metadata: dict[str, Any] | None = None,
    now=None,
) -> WorkerHeartbeat:
    current_time = now or timezone.now()
    heartbeat, _ = WorkerHeartbeat.objects.update_or_create(
        worker_name=worker_name,
        defaults={
            "last_seen_at": current_time,
            "last_run_started_at": last_run_started_at,
            "last_run_completed_at": last_run_completed_at,
            "processed_count": processed_count,
            "queue_depth": queue_depth,
            "last_error": last_error,
            "metadata": metadata or {},
        },
    )
    return heartbeat


@transaction.atomic
def _open_or_refresh_alert(
    *,
    openid: str,
    operator_name: str,
    alert_type: str,
    alert_key: str,
    summary: str,
    severity: str,
    payload: dict[str, Any] | None = None,
    warehouse=None,
    scheduled_task: ScheduledTask | None = None,
    background_task: BackgroundTask | None = None,
) -> AutomationAlert:
    alert, created = AutomationAlert.objects.get_or_create(
        openid=openid,
        alert_type=alert_type,
        alert_key=alert_key,
        status=AutomationAlertStatus.OPEN,
        is_delete=False,
        defaults={
            "warehouse": warehouse,
            "scheduled_task": scheduled_task,
            "background_task": background_task,
            "severity": severity,
            "summary": summary,
            "payload": payload or {},
            "creator": operator_name,
        },
    )
    if not created:
        alert.severity = severity
        alert.summary = summary
        alert.payload = payload or {}
        alert.warehouse = warehouse
        alert.scheduled_task = scheduled_task
        alert.background_task = background_task
        alert.save(
            update_fields=[
                "severity",
                "summary",
                "payload",
                "warehouse",
                "scheduled_task",
                "background_task",
                "update_time",
            ]
        )
    return alert


@transaction.atomic
def _resolve_alerts(*, openid: str, operator_name: str, alert_type: str, open_keys: set[str], now=None) -> int:
    current_time = now or timezone.now()
    queryset = AutomationAlert.objects.filter(
        openid=openid,
        alert_type=alert_type,
        status=AutomationAlertStatus.OPEN,
        is_delete=False,
    )
    if open_keys:
        queryset = queryset.exclude(alert_key__in=open_keys)
    resolved = queryset.update(
        status=AutomationAlertStatus.RESOLVED,
        resolved_at=current_time,
        resolved_by=operator_name,
        update_time=current_time,
    )
    return resolved


@transaction.atomic
def evaluate_automation_alerts(*, operator_name: str = "system-worker", now=None) -> dict[str, int]:
    current_time = now or timezone.now()
    stale_cutoff = current_time - timedelta(minutes=5)
    retry_cutoff = current_time - timedelta(minutes=15)
    open_dead_keys_by_openid: dict[str, set[str]] = {}
    open_retry_keys_by_openid: dict[str, set[str]] = {}
    open_stale_worker_keys_by_openid: dict[str, set[str]] = {}

    dead_tasks = list(
        BackgroundTask.objects.select_related("warehouse", "scheduled_task")
        .filter(is_delete=False, status=BackgroundTaskStatus.DEAD)
        .order_by("openid", "id")
    )
    for task in dead_tasks:
        key = f"dead-task:{task.id}"
        open_dead_keys_by_openid.setdefault(task.openid, set()).add(key)
        _open_or_refresh_alert(
            openid=task.openid,
            operator_name=operator_name,
            alert_type=AutomationAlertType.DEAD_TASK,
            alert_key=key,
            summary=f"Background task {task.id} is dead after {task.attempt_count} attempts",
            severity=AutomationAlertSeverity.CRITICAL,
            payload={"task_id": task.id, "task_type": task.task_type, "reference_code": task.reference_code},
            warehouse=task.warehouse,
            scheduled_task=task.scheduled_task,
            background_task=task,
        )

    retry_backlog = (
        BackgroundTask.objects.filter(
            is_delete=False,
            status__in=[BackgroundTaskStatus.RETRY, BackgroundTaskStatus.RUNNING],
            update_time__lte=retry_cutoff,
        )
        .values("openid")
        .annotate(task_count=Count("id"))
    )
    for row in retry_backlog:
        openid = str(row["openid"])
        key = "retry-backlog"
        open_retry_keys_by_openid.setdefault(openid, set()).add(key)
        _open_or_refresh_alert(
            openid=openid,
            operator_name=operator_name,
            alert_type=AutomationAlertType.RETRY_BACKLOG,
            alert_key=key,
            summary=f"{row['task_count']} background tasks are stalled in retry or running state",
            severity=AutomationAlertSeverity.WARNING,
            payload={"task_count": row["task_count"]},
        )

    active_workers = set(
        WorkerHeartbeat.objects.filter(last_seen_at__gte=stale_cutoff).values_list("worker_name", flat=True)
    )
    queued_openids = (
        BackgroundTask.objects.filter(
            is_delete=False,
            status__in=[BackgroundTaskStatus.QUEUED, BackgroundTaskStatus.RETRY],
            available_at__lte=current_time,
        )
        .values("openid")
        .annotate(task_count=Count("id"))
    )
    if not active_workers:
        for row in queued_openids:
            openid = str(row["openid"])
            key = "stale-worker"
            open_stale_worker_keys_by_openid.setdefault(openid, set()).add(key)
            _open_or_refresh_alert(
                openid=openid,
                operator_name=operator_name,
                alert_type=AutomationAlertType.STALE_WORKER,
                alert_key=key,
                summary=f"No active worker heartbeat detected while {row['task_count']} tasks are queued",
                severity=AutomationAlertSeverity.CRITICAL,
                payload={"task_count": row["task_count"]},
            )

    existing_alert_openids = set(
        AutomationAlert.objects.filter(
            is_delete=False,
            status=AutomationAlertStatus.OPEN,
            alert_type__in=[
                AutomationAlertType.DEAD_TASK,
                AutomationAlertType.RETRY_BACKLOG,
                AutomationAlertType.STALE_WORKER,
            ],
        ).values_list("openid", flat=True)
    )
    touched_openids = (
        set(open_dead_keys_by_openid)
        | set(open_retry_keys_by_openid)
        | set(open_stale_worker_keys_by_openid)
        | existing_alert_openids
    )
    for openid in touched_openids:
        _resolve_alerts(
            openid=openid,
            operator_name=operator_name,
            alert_type=AutomationAlertType.DEAD_TASK,
            open_keys=open_dead_keys_by_openid.get(openid, set()),
            now=current_time,
        )
        _resolve_alerts(
            openid=openid,
            operator_name=operator_name,
            alert_type=AutomationAlertType.RETRY_BACKLOG,
            open_keys=open_retry_keys_by_openid.get(openid, set()),
            now=current_time,
        )
        _resolve_alerts(
            openid=openid,
            operator_name=operator_name,
            alert_type=AutomationAlertType.STALE_WORKER,
            open_keys=open_stale_worker_keys_by_openid.get(openid, set()),
            now=current_time,
        )
    return {
        "dead_task_alerts": sum(len(keys) for keys in open_dead_keys_by_openid.values()),
        "retry_alerts": sum(len(keys) for keys in open_retry_keys_by_openid.values()),
        "stale_worker_alerts": sum(len(keys) for keys in open_stale_worker_keys_by_openid.values()),
    }


def build_automation_dashboard(*, openid: str, now=None) -> dict[str, Any]:
    current_time = now or timezone.now()
    queued_tasks = BackgroundTask.objects.filter(
        openid=openid,
        is_delete=False,
        status=BackgroundTaskStatus.QUEUED,
        available_at__lte=current_time,
    )
    retry_tasks = BackgroundTask.objects.filter(openid=openid, is_delete=False, status=BackgroundTaskStatus.RETRY)
    dead_tasks = BackgroundTask.objects.filter(openid=openid, is_delete=False, status=BackgroundTaskStatus.DEAD)
    running_tasks = BackgroundTask.objects.filter(openid=openid, is_delete=False, status=BackgroundTaskStatus.RUNNING)
    oldest_queued = queued_tasks.order_by("available_at", "id").first()
    alerts = list(
        AutomationAlert.objects.filter(openid=openid, is_delete=False, status=AutomationAlertStatus.OPEN).order_by("-opened_at", "-id")[:20]
    )
    workers = list(WorkerHeartbeat.objects.order_by("worker_name"))
    return {
        "queue": {
            "queued": queued_tasks.count(),
            "retry": retry_tasks.count(),
            "running": running_tasks.count(),
            "dead": dead_tasks.count(),
            "oldest_queued_at": oldest_queued.available_at.isoformat() if oldest_queued else "",
        },
        "workers": [
            {
                "worker_name": worker.worker_name,
                "last_seen_at": worker.last_seen_at.isoformat(),
                "last_run_started_at": worker.last_run_started_at.isoformat() if worker.last_run_started_at else "",
                "last_run_completed_at": worker.last_run_completed_at.isoformat() if worker.last_run_completed_at else "",
                "processed_count": worker.processed_count,
                "queue_depth": worker.queue_depth,
                "last_error": worker.last_error,
            }
            for worker in workers
        ],
        "alerts": [
            {
                "id": alert.id,
                "alert_type": alert.alert_type,
                "severity": alert.severity,
                "summary": alert.summary,
                "alert_key": alert.alert_key,
                "opened_at": alert.opened_at.isoformat(),
            }
            for alert in alerts
        ],
    }


@transaction.atomic
def enqueue_integration_job_task(*, openid: str, operator_name: str, integration_job) -> BackgroundTask:
    existing = BackgroundTask.objects.filter(
        openid=openid,
        integration_job=integration_job,
        is_delete=False,
        status__in=[BackgroundTaskStatus.QUEUED, BackgroundTaskStatus.RUNNING, BackgroundTaskStatus.RETRY],
    ).first()
    if existing is not None:
        return existing
    return enqueue_background_task(
        openid=openid,
        operator_name=operator_name,
        task_type=BackgroundTaskType.PROCESS_INTEGRATION_JOB,
        integration_job=integration_job,
        warehouse=getattr(integration_job, "warehouse", None),
        reference_code=integration_job.reference_code,
        payload={"integration_job_id": integration_job.id},
        max_attempts=3,
        retry_backoff_seconds=60,
    )


@transaction.atomic
def enqueue_due_scheduled_tasks(*, now=None) -> int:
    current_time = now or timezone.now()
    created = 0
    schedules = list(
        ScheduledTask.objects.select_for_update().filter(
            is_delete=False,
            is_active=True,
            next_run_at__lte=current_time,
        )
    )
    for schedule in schedules:
        if schedule.task_type == BackgroundTaskType.PROCESS_INTEGRATION_JOB:
            schedule.last_error = "Scheduled PROCESS_INTEGRATION_JOB is not supported"
            schedule.save(update_fields=["last_error", "update_time"])
            continue
        enqueue_background_task(
            openid=schedule.openid,
            operator_name=schedule.creator or "system",
            task_type=schedule.task_type,
            warehouse=schedule.warehouse,
            customer=schedule.customer,
            scheduled_task=schedule,
            reference_code=schedule.name,
            payload=schedule.payload,
            priority=schedule.priority,
            max_attempts=schedule.max_attempts,
            retry_backoff_seconds=60,
            available_at=current_time,
        )
        schedule.last_enqueued_at = current_time
        schedule.next_run_at = current_time + timedelta(minutes=max(schedule.interval_minutes, 1))
        schedule.last_error = ""
        schedule.save(update_fields=["last_enqueued_at", "next_run_at", "last_error", "update_time"])
        created += 1
    return created


@transaction.atomic
def claim_next_background_task(*, worker_name: str, now=None) -> BackgroundTask | None:
    current_time = now or timezone.now()
    task = (
        BackgroundTask.objects.select_for_update(of=("self",))
        .select_related("scheduled_task", "warehouse", "customer", "integration_job")
        .filter(
            is_delete=False,
            status__in=[BackgroundTaskStatus.QUEUED, BackgroundTaskStatus.RETRY],
            available_at__lte=current_time,
        )
        .order_by("priority", "available_at", "id")
        .first()
    )
    if task is None:
        return None
    task.status = BackgroundTaskStatus.RUNNING
    task.started_at = current_time
    task.attempt_count += 1
    task.locked_by = worker_name
    task.save(update_fields=["status", "started_at", "attempt_count", "locked_by", "update_time"])
    return task


def _execute_integration_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from integrations.services import complete_integration_job, execute_integration_job, fail_integration_job, start_integration_job

    job = task.integration_job
    if job is None:
        raise ValueError("Integration background task is missing integration_job")
    start_integration_job(openid=task.openid, operator_name=operator_name, job=job)
    try:
        response_payload = execute_integration_job(openid=task.openid, operator_name=operator_name, job=job)
    except Exception as exc:
        fail_integration_job(
            openid=task.openid,
            operator_name=operator_name,
            job=job,
            error_message=str(exc),
            response_payload={"background_task_id": task.id},
        )
        raise
    complete_integration_job(openid=task.openid, operator_name=operator_name, job=job, response_payload=response_payload)
    return {"integration_job_id": job.id, "status": "completed"}



def _execute_kpi_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from reporting.services import KpiSnapshotPayload, generate_warehouse_kpi_snapshot

    warehouse = task.warehouse or task.scheduled_task.warehouse  # type: ignore[union-attr]
    snapshot_date = _parse_iso_date(task.payload.get("snapshot_date"), field_name="snapshot_date") if task.payload.get("snapshot_date") else timezone.localdate()
    snapshot = generate_warehouse_kpi_snapshot(
        openid=task.openid,
        operator_name=operator_name,
        payload=KpiSnapshotPayload(warehouse=warehouse, snapshot_date=snapshot_date),
    )
    return {"snapshot_id": snapshot.id}



def _execute_report_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from reporting.services import OperationalReportPayload, generate_operational_report

    warehouse = task.warehouse or getattr(task.scheduled_task, "warehouse", None)
    date_from = _parse_iso_date(task.payload.get("date_from"), field_name="date_from") if task.payload.get("date_from") else None
    date_to = _parse_iso_date(task.payload.get("date_to"), field_name="date_to") if task.payload.get("date_to") else None
    report = generate_operational_report(
        openid=task.openid,
        operator_name=operator_name,
        payload=OperationalReportPayload(
            warehouse=warehouse,
            report_type=str(task.payload["report_type"]),
            date_from=date_from,
            date_to=date_to,
            parameters=task.payload,
        ),
    )
    task.report_export = report
    task.save(update_fields=["report_export", "update_time"])
    return {"report_export_id": report.id, "row_count": report.row_count}


def _execute_storage_accrual_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from reporting.services import StorageAccrualPayload, generate_storage_accrual_run

    warehouse = task.warehouse or getattr(task.scheduled_task, "warehouse", None)
    customer = task.customer or getattr(task.scheduled_task, "customer", None)
    if warehouse is None or customer is None:
        raise ValidationError({"detail": "Storage accrual tasks require warehouse and customer scope"})
    accrual_date = _parse_iso_date(task.payload.get("accrual_date"), field_name="accrual_date") if task.payload.get("accrual_date") else timezone.localdate()
    accrual_run = generate_storage_accrual_run(
        openid=task.openid,
        operator_name=operator_name,
        payload=StorageAccrualPayload(
            warehouse=warehouse,
            customer=customer,
            accrual_date=accrual_date,
            notes=str(task.payload.get("notes", "")),
        ),
    )
    return {"storage_accrual_run_id": accrual_run.id, "charge_event_id": accrual_run.charge_event_id}



def _execute_invoice_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from reporting.invoicing_services import InvoiceGenerationPayload, generate_invoice

    warehouse = task.warehouse or getattr(task.scheduled_task, "warehouse", None)
    customer = task.customer or getattr(task.scheduled_task, "customer", None)
    period_start = _parse_iso_date(task.payload.get("period_start"), field_name="period_start")
    period_end = _parse_iso_date(task.payload.get("period_end"), field_name="period_end")
    invoice = generate_invoice(
        openid=task.openid,
        operator_name=operator_name,
        payload=InvoiceGenerationPayload(
            warehouse=warehouse,
            customer=customer,
            period_start=period_start,
            period_end=period_end,
            invoice_number=_build_invoice_number(task=task, period_start=period_start, period_end=period_end),
            notes=str(task.payload.get("notes", "")),
        ),
    )
    task.invoice = invoice
    task.save(update_fields=["invoice", "update_time"])
    return {"invoice_id": invoice.id, "invoice_number": invoice.invoice_number}


def _execute_finance_export_task(*, task: BackgroundTask, operator_name: str) -> dict[str, Any]:
    from reporting.services import FinanceExportPayload, generate_finance_export

    warehouse = task.warehouse or getattr(task.scheduled_task, "warehouse", None)
    customer = task.customer or getattr(task.scheduled_task, "customer", None)
    period_start = _parse_iso_date(task.payload.get("period_start"), field_name="period_start")
    period_end = _parse_iso_date(task.payload.get("period_end"), field_name="period_end")
    export = generate_finance_export(
        openid=task.openid,
        operator_name=operator_name,
        payload=FinanceExportPayload(
            warehouse=warehouse,
            customer=customer,
            period_start=period_start,
            period_end=period_end,
            parameters=task.payload,
        ),
    )
    return {"finance_export_id": export.id, "row_count": export.row_count}


HANDLERS = {
    BackgroundTaskType.PROCESS_INTEGRATION_JOB: _execute_integration_task,
    BackgroundTaskType.GENERATE_KPI_SNAPSHOT: _execute_kpi_task,
    BackgroundTaskType.GENERATE_OPERATIONAL_REPORT: _execute_report_task,
    BackgroundTaskType.GENERATE_STORAGE_ACCRUAL: _execute_storage_accrual_task,
    BackgroundTaskType.GENERATE_INVOICE: _execute_invoice_task,
    BackgroundTaskType.GENERATE_FINANCE_EXPORT: _execute_finance_export_task,
}


@transaction.atomic
def mark_background_task_succeeded(*, task: BackgroundTask, result_summary: dict[str, Any], now=None) -> BackgroundTask:
    current_time = now or timezone.now()
    task.status = BackgroundTaskStatus.SUCCEEDED
    task.completed_at = current_time
    task.result_summary = result_summary
    task.last_error = ""
    task.locked_by = ""
    task.save(update_fields=["status", "completed_at", "result_summary", "last_error", "locked_by", "update_time"])
    if task.scheduled_task_id:
        ScheduledTask.objects.filter(pk=task.scheduled_task_id).update(last_completed_at=current_time, last_error="", update_time=current_time)
    return task


@transaction.atomic
def mark_background_task_failed(*, task: BackgroundTask, error_message: str, now=None) -> BackgroundTask:
    current_time = now or timezone.now()
    if task.attempt_count < task.max_attempts:
        task.status = BackgroundTaskStatus.RETRY
        task.available_at = current_time + timedelta(seconds=task.retry_backoff_seconds * (2 ** max(task.attempt_count - 1, 0)))
    else:
        task.status = BackgroundTaskStatus.DEAD
        task.completed_at = current_time
    task.last_error = error_message
    task.locked_by = ""
    task.save(update_fields=["status", "available_at", "completed_at", "last_error", "locked_by", "update_time"])
    if task.scheduled_task_id:
        ScheduledTask.objects.filter(pk=task.scheduled_task_id).update(last_error=error_message, update_time=current_time)
    return task


@transaction.atomic
def requeue_background_task(*, openid: str, operator_name: str, task: BackgroundTask, now=None) -> BackgroundTask:
    from integrations.models import CarrierBooking, CarrierBookingStatus, IntegrationJobStatus, IntegrationJobType, WebhookEventStatus
    from integrations.services import append_integration_log

    ensure_tenant_match(task, openid, "Background task")
    current_time = now or timezone.now()
    locked_task = (
        BackgroundTask.objects.select_for_update(of=("self",))
        .select_related("integration_job", "integration_job__source_webhook")
        .get(pk=task.pk)
    )
    if locked_task.status not in {BackgroundTaskStatus.DEAD, BackgroundTaskStatus.RETRY}:
        raise ValidationError({"detail": "Only dead or retry-scheduled tasks can be requeued"})

    locked_task.status = BackgroundTaskStatus.QUEUED
    locked_task.available_at = current_time
    locked_task.started_at = None
    locked_task.completed_at = None
    locked_task.attempt_count = 0
    locked_task.locked_by = ""
    locked_task.last_error = ""
    locked_task.result_summary = {}
    locked_task.save(
        update_fields=[
            "status",
            "available_at",
            "started_at",
            "completed_at",
            "attempt_count",
            "locked_by",
            "last_error",
            "result_summary",
            "update_time",
        ]
    )

    job = locked_task.integration_job
    if job is not None:
        job.status = IntegrationJobStatus.QUEUED
        job.started_at = None
        job.completed_at = None
        job.attempt_count = 0
        job.last_error = ""
        job.response_payload = {}
        job.triggered_by = operator_name
        job.save(
            update_fields=[
                "status",
                "started_at",
                "completed_at",
                "attempt_count",
                "last_error",
                "response_payload",
                "triggered_by",
                "update_time",
            ]
        )
        if job.source_webhook_id:
            webhook_event = job.source_webhook
            webhook_event.status = WebhookEventStatus.QUEUED
            webhook_event.processed_at = None
            webhook_event.last_error = ""
            webhook_event.save(update_fields=["status", "processed_at", "last_error", "update_time"])
        if job.job_type == IntegrationJobType.CARRIER_BOOKING:
            CarrierBooking.objects.filter(booking_job=job, is_delete=False).update(
                status=CarrierBookingStatus.OPEN,
                booked_by="",
                booked_at=None,
                last_error="",
                update_time=current_time,
            )
        elif job.job_type == IntegrationJobType.LABEL_GENERATION:
            CarrierBooking.objects.filter(label_job=job, is_delete=False).update(
                status=CarrierBookingStatus.BOOKED,
                label_format="",
                label_document="",
                labeled_at=None,
                last_error="",
                update_time=current_time,
            )
        append_integration_log(
            openid=openid,
            operator_name=operator_name,
            job=job,
            webhook_event=job.source_webhook,
            message="Integration job requeued from background task retry",
            payload={"background_task_id": locked_task.id},
        )
    return locked_task


@transaction.atomic
def run_background_tasks(*, worker_name: str = "default", limit: int = 10, now=None, include_schedules: bool = True) -> int:
    current_time = now or timezone.now()
    record_worker_heartbeat(
        worker_name=worker_name,
        queue_depth=_queue_depth(now=current_time),
        processed_count=0,
        last_run_started_at=current_time,
        last_run_completed_at=None,
        now=current_time,
    )
    if include_schedules:
        enqueue_due_scheduled_tasks(now=current_time)
    processed = 0
    last_error = ""
    for _ in range(limit):
        task = claim_next_background_task(worker_name=worker_name, now=current_time)
        if task is None:
            break
        try:
            handler = HANDLERS[task.task_type]
            result_summary = handler(task=task, operator_name="system-worker")
        except Exception as exc:  # pragma: no cover - branch validated in tests via status checks
            last_error = str(exc)
            mark_background_task_failed(task=task, error_message=str(exc), now=current_time)
        else:
            mark_background_task_succeeded(task=task, result_summary=result_summary, now=current_time)
        processed += 1
    record_worker_heartbeat(
        worker_name=worker_name,
        queue_depth=_queue_depth(now=current_time),
        processed_count=processed,
        last_run_started_at=current_time,
        last_run_completed_at=current_time,
        last_error=last_error,
        metadata={"include_schedules": include_schedules, "limit": limit},
        now=current_time,
    )
    evaluate_automation_alerts(operator_name="system-worker", now=current_time)
    return processed


@transaction.atomic
def run_scheduled_task_now(*, openid: str, operator_name: str, scheduled_task: ScheduledTask) -> BackgroundTask:
    ensure_tenant_match(scheduled_task, openid, "Scheduled task")
    if scheduled_task.task_type == BackgroundTaskType.PROCESS_INTEGRATION_JOB:
        raise ValidationError({"detail": "Scheduled tasks support reporting and billing task types only"})
    return enqueue_background_task(
        openid=openid,
        operator_name=operator_name,
        task_type=scheduled_task.task_type,
        warehouse=scheduled_task.warehouse,
        customer=scheduled_task.customer,
        scheduled_task=scheduled_task,
        reference_code=scheduled_task.name,
        payload=scheduled_task.payload,
        priority=scheduled_task.priority,
        max_attempts=scheduled_task.max_attempts,
    )
