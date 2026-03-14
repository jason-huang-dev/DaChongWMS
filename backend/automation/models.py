"""Database-backed worker queue and schedule models."""

from __future__ import annotations

from django.db import models
from django.db.models import Q
from django.utils import timezone


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class BackgroundTaskType(models.TextChoices):
    PROCESS_INTEGRATION_JOB = "PROCESS_INTEGRATION_JOB", "Process Integration Job"
    GENERATE_KPI_SNAPSHOT = "GENERATE_KPI_SNAPSHOT", "Generate KPI Snapshot"
    GENERATE_OPERATIONAL_REPORT = "GENERATE_OPERATIONAL_REPORT", "Generate Operational Report"
    GENERATE_STORAGE_ACCRUAL = "GENERATE_STORAGE_ACCRUAL", "Generate Storage Accrual"
    GENERATE_INVOICE = "GENERATE_INVOICE", "Generate Invoice"
    GENERATE_FINANCE_EXPORT = "GENERATE_FINANCE_EXPORT", "Generate Finance Export"


class BackgroundTaskStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    RUNNING = "RUNNING", "Running"
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    RETRY = "RETRY", "Retry Scheduled"
    DEAD = "DEAD", "Dead"


class AutomationAlertType(models.TextChoices):
    DEAD_TASK = "DEAD_TASK", "Dead Task"
    RETRY_BACKLOG = "RETRY_BACKLOG", "Retry Backlog"
    STALE_WORKER = "STALE_WORKER", "Stale Worker"


class AutomationAlertSeverity(models.TextChoices):
    WARNING = "WARNING", "Warning"
    CRITICAL = "CRITICAL", "Critical"


class AutomationAlertStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    RESOLVED = "RESOLVED", "Resolved"


class ScheduledTask(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="scheduled_tasks",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    customer = models.ForeignKey(
        "customer.ListModel",
        on_delete=models.PROTECT,
        related_name="scheduled_tasks",
        blank=True,
        null=True,
        verbose_name="Customer",
    )
    name = models.CharField(max_length=128, verbose_name="Name")
    task_type = models.CharField(max_length=32, choices=BackgroundTaskType.choices, verbose_name="Task Type")
    interval_minutes = models.PositiveIntegerField(default=1440, verbose_name="Interval Minutes")
    next_run_at = models.DateTimeField(default=timezone.now, verbose_name="Next Run At")
    priority = models.PositiveIntegerField(default=100, verbose_name="Priority")
    max_attempts = models.PositiveIntegerField(default=3, verbose_name="Max Attempts")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    last_enqueued_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Enqueued At")
    last_completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Completed At")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "automation_scheduled_task"
        verbose_name = "Scheduled Task"
        verbose_name_plural = "Scheduled Tasks"
        ordering = ["next_run_at", "priority", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "name"],
                condition=Q(is_delete=False),
                name="automation_schedule_name_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.name


class BackgroundTask(TenantAuditModel):
    scheduled_task = models.ForeignKey(
        ScheduledTask,
        on_delete=models.PROTECT,
        related_name="task_runs",
        blank=True,
        null=True,
        verbose_name="Scheduled Task",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="background_tasks",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    customer = models.ForeignKey(
        "customer.ListModel",
        on_delete=models.PROTECT,
        related_name="background_tasks",
        blank=True,
        null=True,
        verbose_name="Customer",
    )
    integration_job = models.ForeignKey(
        "integrations.IntegrationJob",
        on_delete=models.PROTECT,
        related_name="background_tasks",
        blank=True,
        null=True,
        verbose_name="Integration Job",
    )
    report_export = models.ForeignKey(
        "reporting.OperationalReportExport",
        on_delete=models.PROTECT,
        related_name="background_tasks",
        blank=True,
        null=True,
        verbose_name="Report Export",
    )
    invoice = models.ForeignKey(
        "reporting.Invoice",
        on_delete=models.PROTECT,
        related_name="background_tasks",
        blank=True,
        null=True,
        verbose_name="Invoice",
    )
    task_type = models.CharField(max_length=32, choices=BackgroundTaskType.choices, verbose_name="Task Type")
    status = models.CharField(
        max_length=16,
        choices=BackgroundTaskStatus.choices,
        default=BackgroundTaskStatus.QUEUED,
        verbose_name="Status",
    )
    priority = models.PositiveIntegerField(default=100, verbose_name="Priority")
    available_at = models.DateTimeField(default=timezone.now, verbose_name="Available At")
    started_at = models.DateTimeField(blank=True, null=True, verbose_name="Started At")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    attempt_count = models.PositiveIntegerField(default=0, verbose_name="Attempt Count")
    max_attempts = models.PositiveIntegerField(default=3, verbose_name="Max Attempts")
    retry_backoff_seconds = models.PositiveIntegerField(default=60, verbose_name="Retry Backoff Seconds")
    locked_by = models.CharField(max_length=128, blank=True, default="", verbose_name="Locked By")
    reference_code = models.CharField(max_length=128, blank=True, default="", verbose_name="Reference Code")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    result_summary = models.JSONField(default=dict, blank=True, verbose_name="Result Summary")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")

    class Meta:
        db_table = "automation_background_task"
        verbose_name = "Background Task"
        verbose_name_plural = "Background Tasks"
        ordering = ["priority", "available_at", "id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.task_type}:{self.id}"


class WorkerHeartbeat(models.Model):
    worker_name = models.CharField(max_length=128, unique=True, verbose_name="Worker Name")
    last_seen_at = models.DateTimeField(default=timezone.now, verbose_name="Last Seen At")
    last_run_started_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Run Started At")
    last_run_completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Run Completed At")
    processed_count = models.PositiveIntegerField(default=0, verbose_name="Processed Count")
    queue_depth = models.PositiveIntegerField(default=0, verbose_name="Queue Depth")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadata")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = "automation_worker_heartbeat"
        verbose_name = "Worker Heartbeat"
        verbose_name_plural = "Worker Heartbeats"
        ordering = ["worker_name"]

    def __str__(self) -> str:  # pragma: no cover
        return self.worker_name


class AutomationAlert(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="automation_alerts",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    scheduled_task = models.ForeignKey(
        ScheduledTask,
        on_delete=models.PROTECT,
        related_name="automation_alerts",
        blank=True,
        null=True,
        verbose_name="Scheduled Task",
    )
    background_task = models.ForeignKey(
        BackgroundTask,
        on_delete=models.PROTECT,
        related_name="automation_alerts",
        blank=True,
        null=True,
        verbose_name="Background Task",
    )
    alert_type = models.CharField(max_length=32, choices=AutomationAlertType.choices, verbose_name="Alert Type")
    severity = models.CharField(
        max_length=16,
        choices=AutomationAlertSeverity.choices,
        default=AutomationAlertSeverity.WARNING,
        verbose_name="Severity",
    )
    status = models.CharField(
        max_length=16,
        choices=AutomationAlertStatus.choices,
        default=AutomationAlertStatus.OPEN,
        verbose_name="Status",
    )
    alert_key = models.CharField(max_length=255, verbose_name="Alert Key")
    summary = models.TextField(verbose_name="Summary")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    opened_at = models.DateTimeField(default=timezone.now, verbose_name="Opened At")
    resolved_at = models.DateTimeField(blank=True, null=True, verbose_name="Resolved At")
    resolved_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Resolved By")

    class Meta:
        db_table = "automation_alert"
        verbose_name = "Automation Alert"
        verbose_name_plural = "Automation Alerts"
        ordering = ["-opened_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "alert_type", "alert_key", "status"],
                condition=Q(is_delete=False, status=AutomationAlertStatus.OPEN),
                name="automation_open_alert_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.alert_type}:{self.alert_key}"
