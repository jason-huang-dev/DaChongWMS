"""ERP, carrier, webhook, and integration audit models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
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


class IntegrationSystemType(models.TextChoices):
    ERP = "ERP", "ERP"
    CARRIER = "CARRIER", "Carrier"
    WEBHOOK = "WEBHOOK", "Webhook"


class IntegrationDirection(models.TextChoices):
    IMPORT = "IMPORT", "Import"
    EXPORT = "EXPORT", "Export"


class IntegrationJobStatus(models.TextChoices):
    QUEUED = "QUEUED", "Queued"
    RUNNING = "RUNNING", "Running"
    SUCCEEDED = "SUCCEEDED", "Succeeded"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"


class IntegrationJobType(models.TextChoices):
    ERP_SYNC = "ERP_SYNC", "ERP Sync"
    STOCK_EXPORT = "STOCK_EXPORT", "Stock Export"
    SHIPMENT_EXPORT = "SHIPMENT_EXPORT", "Shipment Export"
    CARRIER_BOOKING = "CARRIER_BOOKING", "Carrier Booking"
    LABEL_GENERATION = "LABEL_GENERATION", "Label Generation"
    WEBHOOK_PROCESSING = "WEBHOOK_PROCESSING", "Webhook Processing"


class IntegrationLogLevel(models.TextChoices):
    INFO = "INFO", "Info"
    WARNING = "WARNING", "Warning"
    ERROR = "ERROR", "Error"


class WebhookEventStatus(models.TextChoices):
    RECEIVED = "RECEIVED", "Received"
    QUEUED = "QUEUED", "Queued"
    PROCESSED = "PROCESSED", "Processed"
    FAILED = "FAILED", "Failed"
    IGNORED = "IGNORED", "Ignored"


class CarrierBookingStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    BOOKED = "BOOKED", "Booked"
    LABELED = "LABELED", "Labeled"
    FAILED = "FAILED", "Failed"
    CANCELLED = "CANCELLED", "Cancelled"


class WebhookEvent(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="webhook_events",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    system_type = models.CharField(
        max_length=16,
        choices=IntegrationSystemType.choices,
        default=IntegrationSystemType.WEBHOOK,
        verbose_name="System Type",
    )
    source_system = models.CharField(max_length=64, verbose_name="Source System")
    event_type = models.CharField(max_length=128, verbose_name="Event Type")
    event_key = models.CharField(max_length=128, verbose_name="Event Key")
    signature = models.CharField(max_length=255, blank=True, default="", verbose_name="Signature")
    headers = models.JSONField(default=dict, blank=True, verbose_name="Headers")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    status = models.CharField(
        max_length=16,
        choices=WebhookEventStatus.choices,
        default=WebhookEventStatus.RECEIVED,
        verbose_name="Status",
    )
    received_at = models.DateTimeField(default=timezone.now, verbose_name="Received At")
    processed_at = models.DateTimeField(blank=True, null=True, verbose_name="Processed At")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")

    class Meta:
        db_table = "integrations_webhook_event"
        verbose_name = "Webhook Event"
        verbose_name_plural = "Webhook Events"
        ordering = ["-received_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "source_system", "event_key"],
                condition=Q(is_delete=False),
                name="integrations_webhook_source_key_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.source_system}:{self.event_key}"


class IntegrationJob(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="integration_jobs",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    source_webhook = models.ForeignKey(
        WebhookEvent,
        on_delete=models.PROTECT,
        related_name="integration_jobs",
        blank=True,
        null=True,
        verbose_name="Source Webhook",
    )
    system_type = models.CharField(max_length=16, choices=IntegrationSystemType.choices, verbose_name="System Type")
    integration_name = models.CharField(max_length=64, verbose_name="Integration Name")
    job_type = models.CharField(max_length=32, choices=IntegrationJobType.choices, verbose_name="Job Type")
    direction = models.CharField(max_length=16, choices=IntegrationDirection.choices, verbose_name="Direction")
    status = models.CharField(
        max_length=16,
        choices=IntegrationJobStatus.choices,
        default=IntegrationJobStatus.QUEUED,
        verbose_name="Status",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    external_reference = models.CharField(max_length=128, blank=True, default="", verbose_name="External Reference")
    request_payload = models.JSONField(default=dict, blank=True, verbose_name="Request Payload")
    response_payload = models.JSONField(default=dict, blank=True, verbose_name="Response Payload")
    started_at = models.DateTimeField(blank=True, null=True, verbose_name="Started At")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    attempt_count = models.PositiveIntegerField(default=0, verbose_name="Attempt Count")
    triggered_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Triggered By")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")

    class Meta:
        db_table = "integrations_job"
        verbose_name = "Integration Job"
        verbose_name_plural = "Integration Jobs"
        ordering = ["-create_time", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.integration_name}:{self.job_type}:{self.id}"


class IntegrationLog(TenantAuditModel):
    job = models.ForeignKey(
        IntegrationJob,
        on_delete=models.PROTECT,
        related_name="logs",
        blank=True,
        null=True,
        verbose_name="Integration Job",
    )
    webhook_event = models.ForeignKey(
        WebhookEvent,
        on_delete=models.PROTECT,
        related_name="logs",
        blank=True,
        null=True,
        verbose_name="Webhook Event",
    )
    level = models.CharField(max_length=16, choices=IntegrationLogLevel.choices, default=IntegrationLogLevel.INFO, verbose_name="Level")
    message = models.TextField(verbose_name="Message")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    logged_at = models.DateTimeField(default=timezone.now, verbose_name="Logged At")

    class Meta:
        db_table = "integrations_log"
        verbose_name = "Integration Log"
        verbose_name_plural = "Integration Logs"
        ordering = ["-logged_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.level}:{self.message[:40]}"


class CarrierBooking(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="carrier_bookings",
        verbose_name="Warehouse",
    )
    shipment = models.ForeignKey(
        "outbound.Shipment",
        on_delete=models.PROTECT,
        related_name="carrier_bookings",
        blank=True,
        null=True,
        verbose_name="Shipment",
    )
    booking_job = models.ForeignKey(
        IntegrationJob,
        on_delete=models.PROTECT,
        related_name="bookings",
        blank=True,
        null=True,
        verbose_name="Booking Job",
    )
    label_job = models.ForeignKey(
        IntegrationJob,
        on_delete=models.PROTECT,
        related_name="labeled_bookings",
        blank=True,
        null=True,
        verbose_name="Label Job",
    )
    booking_number = models.CharField(max_length=64, verbose_name="Booking Number")
    carrier_code = models.CharField(max_length=64, verbose_name="Carrier Code")
    service_level = models.CharField(max_length=64, blank=True, default="", verbose_name="Service Level")
    package_count = models.PositiveIntegerField(default=1, verbose_name="Package Count")
    total_weight = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Total Weight",
    )
    status = models.CharField(
        max_length=16,
        choices=CarrierBookingStatus.choices,
        default=CarrierBookingStatus.OPEN,
        verbose_name="Status",
    )
    tracking_number = models.CharField(max_length=128, blank=True, default="", verbose_name="Tracking Number")
    label_format = models.CharField(max_length=16, blank=True, default="", verbose_name="Label Format")
    label_document = models.TextField(blank=True, default="", verbose_name="Label Document")
    external_reference = models.CharField(max_length=128, blank=True, default="", verbose_name="External Reference")
    request_payload = models.JSONField(default=dict, blank=True, verbose_name="Request Payload")
    response_payload = models.JSONField(default=dict, blank=True, verbose_name="Response Payload")
    booked_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Booked By")
    booked_at = models.DateTimeField(blank=True, null=True, verbose_name="Booked At")
    labeled_at = models.DateTimeField(blank=True, null=True, verbose_name="Labeled At")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")

    class Meta:
        db_table = "integrations_carrier_booking"
        verbose_name = "Carrier Booking"
        verbose_name_plural = "Carrier Bookings"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "booking_number"],
                condition=Q(is_delete=False),
                name="integrations_carrier_booking_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.booking_number
