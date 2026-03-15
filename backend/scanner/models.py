"""Barcode aliases, handheld sessions, and scan-first tracking."""

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


class AliasTargetType(models.TextChoices):
    GOODS = "GOODS", "Goods"
    LOCATION = "LOCATION", "Location"


class LicensePlateStatus(models.TextChoices):
    EXPECTED = "EXPECTED", "Expected"
    RECEIVED = "RECEIVED", "Received"
    STORED = "STORED", "Stored"
    STAGED = "STAGED", "Staged"
    LOADED = "LOADED", "Loaded"


class HandheldDeviceSessionStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    ENDED = "ENDED", "Ended"


class OfflineReplayBatchStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    PROCESSING = "PROCESSING", "Processing"
    COMPLETED = "COMPLETED", "Completed"
    CONFLICTED = "CONFLICTED", "Conflicted"
    PARTIAL = "PARTIAL", "Partial"
    FAILED = "FAILED", "Failed"


class OfflineReplayEventType(models.TextChoices):
    INBOUND_RECEIVE = "INBOUND_RECEIVE", "Inbound Receive"
    INBOUND_PUTAWAY = "INBOUND_PUTAWAY", "Inbound Putaway"
    OUTBOUND_PICK = "OUTBOUND_PICK", "Outbound Pick"
    OUTBOUND_SHIP = "OUTBOUND_SHIP", "Outbound Ship"


class OfflineReplayEventStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    APPLIED = "APPLIED", "Applied"
    SKIPPED = "SKIPPED", "Skipped"
    CONFLICT = "CONFLICT", "Conflict"
    FAILED = "FAILED", "Failed"


class OfflineReplayConflictRule(models.TextChoices):
    IDEMPOTENT_SKIP = "IDEMPOTENT_SKIP", "Idempotent Skip"
    MANUAL_REVIEW = "MANUAL_REVIEW", "Manual Review"
    REJECT = "REJECT", "Reject"


class OfflineReplayConflictType(models.TextChoices):
    DUPLICATE_REFERENCE = "DUPLICATE_REFERENCE", "Duplicate Reference"
    STATE_MISMATCH = "STATE_MISMATCH", "State Mismatch"
    TASK_ALREADY_COMPLETED = "TASK_ALREADY_COMPLETED", "Task Already Completed"
    ORDER_ALREADY_SHIPPED = "ORDER_ALREADY_SHIPPED", "Order Already Shipped"
    STALE_REFERENCE = "STALE_REFERENCE", "Stale Reference"


class ListModel(models.Model):
    mode = models.CharField(max_length=255, verbose_name="Mode")
    code = models.TextField(verbose_name="Code")
    bar_code = models.CharField(max_length=255, verbose_name="Bar Code")
    openid = models.CharField(max_length=255, verbose_name="Openid")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        ordering = ["-id"]
        db_table = "scanner"
        verbose_name = "Scanner"
        verbose_name_plural = "Scanners"

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.mode}:{self.code}"


class BarcodeAlias(TenantAuditModel):
    target_type = models.CharField(max_length=32, choices=AliasTargetType.choices, verbose_name="Target Type")
    alias_code = models.CharField(max_length=255, verbose_name="Alias Code")
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="barcode_aliases",
        blank=True,
        null=True,
        verbose_name="Goods",
    )
    location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="barcode_aliases",
        blank=True,
        null=True,
        verbose_name="Location",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "scanner_barcode_alias"
        verbose_name = "Barcode Alias"
        verbose_name_plural = "Barcode Aliases"
        ordering = ["target_type", "alias_code", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "target_type", "alias_code"],
                condition=Q(is_delete=False),
                name="scanner_barcode_alias_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.target_type}:{self.alias_code}"


class GoodsScanRule(TenantAuditModel):
    goods = models.OneToOneField(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="scan_rule",
        verbose_name="Goods",
    )
    requires_lot = models.BooleanField(default=False, verbose_name="Requires Lot")
    requires_serial = models.BooleanField(default=False, verbose_name="Requires Serial")
    lot_pattern = models.CharField(max_length=255, blank=True, default="", verbose_name="Lot Pattern")
    serial_pattern = models.CharField(max_length=255, blank=True, default="", verbose_name="Serial Pattern")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "scanner_goods_scan_rule"
        verbose_name = "Goods Scan Rule"
        verbose_name_plural = "Goods Scan Rules"
        ordering = ["goods_id"]

    def __str__(self) -> str:  # pragma: no cover
        return self.goods.goods_code


class LicensePlate(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="license_plates",
        verbose_name="Warehouse",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="license_plates",
        verbose_name="Goods",
    )
    current_location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="license_plates",
        blank=True,
        null=True,
        verbose_name="Current Location",
    )
    lpn_code = models.CharField(max_length=128, verbose_name="LPN Code")
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
        verbose_name="Quantity",
    )
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    status = models.CharField(
        max_length=16,
        choices=LicensePlateStatus.choices,
        default=LicensePlateStatus.EXPECTED,
        verbose_name="Status",
    )
    reference_code = models.CharField(max_length=64, blank=True, default="", verbose_name="Reference Code")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "scanner_license_plate"
        verbose_name = "License Plate"
        verbose_name_plural = "License Plates"
        ordering = ["-update_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "lpn_code"],
                condition=Q(is_delete=False),
                name="scanner_license_plate_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.lpn_code


class HandheldDeviceSession(TenantAuditModel):
    operator = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="handheld_sessions",
        verbose_name="Operator",
    )
    device_id = models.CharField(max_length=128, verbose_name="Device ID")
    device_label = models.CharField(max_length=255, blank=True, default="", verbose_name="Device Label")
    app_version = models.CharField(max_length=64, blank=True, default="", verbose_name="App Version")
    platform = models.CharField(max_length=64, blank=True, default="", verbose_name="Platform")
    status = models.CharField(
        max_length=16,
        choices=HandheldDeviceSessionStatus.choices,
        default=HandheldDeviceSessionStatus.ACTIVE,
        verbose_name="Status",
    )
    session_started_at = models.DateTimeField(default=timezone.now, verbose_name="Session Started At")
    last_seen_at = models.DateTimeField(default=timezone.now, verbose_name="Last Seen At")
    last_sync_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Sync At")
    session_ended_at = models.DateTimeField(blank=True, null=True, verbose_name="Session Ended At")
    telemetry_sample_count = models.PositiveIntegerField(default=0, verbose_name="Telemetry Sample Count")
    total_scan_count = models.PositiveIntegerField(default=0, verbose_name="Total Scan Count")
    total_sync_count = models.PositiveIntegerField(default=0, verbose_name="Total Sync Count")
    total_replayed_count = models.PositiveIntegerField(default=0, verbose_name="Total Replayed Count")
    total_conflict_count = models.PositiveIntegerField(default=0, verbose_name="Total Conflict Count")
    total_failure_count = models.PositiveIntegerField(default=0, verbose_name="Total Failure Count")
    last_battery_level = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="Last Battery Level")
    last_network_type = models.CharField(max_length=32, blank=True, default="", verbose_name="Last Network Type")
    last_signal_strength = models.IntegerField(blank=True, null=True, verbose_name="Last Signal Strength")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadata")

    class Meta:
        db_table = "scanner_handheld_device_session"
        verbose_name = "Handheld Device Session"
        verbose_name_plural = "Handheld Device Sessions"
        ordering = ["-last_seen_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "device_id"],
                condition=Q(is_delete=False, status=HandheldDeviceSessionStatus.ACTIVE),
                name="scanner_handheld_device_session_active_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.device_id}:{self.status}"


class OfflineReplayBatch(TenantAuditModel):
    session = models.ForeignKey(
        HandheldDeviceSession,
        on_delete=models.PROTECT,
        related_name="replay_batches",
        verbose_name="Session",
    )
    operator = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="offline_replay_batches",
        verbose_name="Operator",
    )
    client_batch_id = models.CharField(max_length=128, verbose_name="Client Batch ID")
    status = models.CharField(
        max_length=16,
        choices=OfflineReplayBatchStatus.choices,
        default=OfflineReplayBatchStatus.PENDING,
        verbose_name="Status",
    )
    submitted_at = models.DateTimeField(default=timezone.now, verbose_name="Submitted At")
    processed_at = models.DateTimeField(blank=True, null=True, verbose_name="Processed At")
    event_count = models.PositiveIntegerField(default=0, verbose_name="Event Count")
    replayed_count = models.PositiveIntegerField(default=0, verbose_name="Replayed Count")
    conflict_count = models.PositiveIntegerField(default=0, verbose_name="Conflict Count")
    failed_count = models.PositiveIntegerField(default=0, verbose_name="Failed Count")
    last_error = models.TextField(blank=True, default="", verbose_name="Last Error")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "scanner_offline_replay_batch"
        verbose_name = "Offline Replay Batch"
        verbose_name_plural = "Offline Replay Batches"
        ordering = ["-submitted_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "session", "client_batch_id"],
                condition=Q(is_delete=False),
                name="scanner_offline_replay_batch_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.client_batch_id


class OfflineReplayEvent(TenantAuditModel):
    batch = models.ForeignKey(
        OfflineReplayBatch,
        on_delete=models.PROTECT,
        related_name="events",
        verbose_name="Batch",
    )
    sequence_number = models.PositiveIntegerField(verbose_name="Sequence Number")
    event_type = models.CharField(max_length=32, choices=OfflineReplayEventType.choices, verbose_name="Event Type")
    status = models.CharField(
        max_length=16,
        choices=OfflineReplayEventStatus.choices,
        default=OfflineReplayEventStatus.PENDING,
        verbose_name="Status",
    )
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    processed_at = models.DateTimeField(blank=True, null=True, verbose_name="Processed At")
    result_record_type = models.CharField(max_length=64, blank=True, default="", verbose_name="Result Record Type")
    result_record_id = models.PositiveBigIntegerField(blank=True, null=True, verbose_name="Result Record ID")
    conflict_rule = models.CharField(max_length=32, choices=OfflineReplayConflictRule.choices, blank=True, default="", verbose_name="Conflict Rule")
    conflict_type = models.CharField(max_length=32, choices=OfflineReplayConflictType.choices, blank=True, default="", verbose_name="Conflict Type")
    conflict_key = models.CharField(max_length=128, blank=True, default="", verbose_name="Conflict Key")
    result_summary = models.TextField(blank=True, default="", verbose_name="Result Summary")
    error_message = models.TextField(blank=True, default="", verbose_name="Error Message")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "scanner_offline_replay_event"
        verbose_name = "Offline Replay Event"
        verbose_name_plural = "Offline Replay Events"
        ordering = ["batch_id", "sequence_number", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "batch", "sequence_number"],
                condition=Q(is_delete=False),
                name="scanner_offline_replay_event_unique",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.batch_id}:{self.sequence_number}"


class HandheldTelemetrySample(TenantAuditModel):
    session = models.ForeignKey(
        HandheldDeviceSession,
        on_delete=models.PROTECT,
        related_name="telemetry_samples",
        verbose_name="Session",
    )
    operator = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="handheld_telemetry_samples",
        verbose_name="Operator",
    )
    recorded_at = models.DateTimeField(default=timezone.now, verbose_name="Recorded At")
    scan_count = models.PositiveIntegerField(default=0, verbose_name="Scan Count")
    queued_event_count = models.PositiveIntegerField(default=0, verbose_name="Queued Event Count")
    sync_count = models.PositiveIntegerField(default=0, verbose_name="Sync Count")
    replay_conflict_count = models.PositiveIntegerField(default=0, verbose_name="Replay Conflict Count")
    replay_failure_count = models.PositiveIntegerField(default=0, verbose_name="Replay Failure Count")
    battery_level = models.PositiveSmallIntegerField(blank=True, null=True, verbose_name="Battery Level")
    network_type = models.CharField(max_length=32, blank=True, default="", verbose_name="Network Type")
    signal_strength = models.IntegerField(blank=True, null=True, verbose_name="Signal Strength")
    latency_ms = models.PositiveIntegerField(blank=True, null=True, verbose_name="Latency Ms")
    storage_free_mb = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        verbose_name="Storage Free Mb",
    )
    metadata = models.JSONField(default=dict, blank=True, verbose_name="Metadata")

    class Meta:
        db_table = "scanner_handheld_telemetry_sample"
        verbose_name = "Handheld Telemetry Sample"
        verbose_name_plural = "Handheld Telemetry Samples"
        ordering = ["-recorded_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.session_id}:{self.recorded_at.isoformat()}"
