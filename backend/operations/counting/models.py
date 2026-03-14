"""Cycle count, variance, and approval models."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from inventory.models import InventoryAdjustmentApprovalRule, InventoryAdjustmentReason, InventoryBalance, InventoryMovement


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class CycleCountStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    COUNTED = "COUNTED", "Counted"
    RECOUNT_IN_PROGRESS = "RECOUNT_IN_PROGRESS", "Recount In Progress"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Pending Approval"
    COMPLETED = "COMPLETED", "Completed"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class CycleCountLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    COUNTED = "COUNTED", "Counted"
    RECOUNT_ASSIGNED = "RECOUNT_ASSIGNED", "Recount Assigned"
    PENDING_APPROVAL = "PENDING_APPROVAL", "Pending Approval"
    RECONCILED = "RECONCILED", "Reconciled"
    REJECTED = "REJECTED", "Rejected"
    CANCELLED = "CANCELLED", "Cancelled"


class CountApprovalStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    AUTO_APPROVED = "AUTO_APPROVED", "Auto Approved"
    APPROVED = "APPROVED", "Approved"
    REJECTED = "REJECTED", "Rejected"


class ScannerTaskType(models.TextChoices):
    NONE = "NONE", "None"
    COUNT = "COUNT", "Count"
    RECOUNT = "RECOUNT", "Recount"


class ScannerTaskStatus(models.TextChoices):
    UNASSIGNED = "UNASSIGNED", "Unassigned"
    PENDING = "PENDING", "Pending"
    ACKNOWLEDGED = "ACKNOWLEDGED", "Acknowledged"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"


class CycleCount(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="cycle_counts",
        verbose_name="Warehouse",
    )
    count_number = models.CharField(max_length=64, verbose_name="Cycle Count Number")
    scheduled_date = models.DateField(blank=True, null=True, verbose_name="Scheduled Date")
    is_blind_count = models.BooleanField(default=False, verbose_name="Is Blind Count")
    status = models.CharField(
        max_length=32,
        choices=CycleCountStatus.choices,
        default=CycleCountStatus.OPEN,
        verbose_name="Status",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    submitted_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Submitted By")
    submitted_at = models.DateTimeField(blank=True, null=True, verbose_name="Submitted At")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")

    class Meta:
        db_table = "counting_cycle_count"
        verbose_name = "Cycle Count"
        verbose_name_plural = "Cycle Counts"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "count_number"],
                condition=Q(is_delete=False),
                name="count_cycle_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.count_number


class CycleCountLine(TenantAuditModel):
    cycle_count = models.ForeignKey(
        CycleCount,
        on_delete=models.PROTECT,
        related_name="lines",
        verbose_name="Cycle Count",
    )
    line_number = models.PositiveIntegerField(verbose_name="Line Number")
    inventory_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.PROTECT,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
        verbose_name="Inventory Balance",
    )
    location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="cycle_count_lines",
        verbose_name="Location",
    )
    goods = models.ForeignKey(
        "goods.ListModel",
        on_delete=models.PROTECT,
        related_name="cycle_count_lines",
        verbose_name="Goods",
    )
    stock_status = models.CharField(max_length=32, verbose_name="Stock Status")
    lot_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Lot Number")
    serial_number = models.CharField(max_length=64, blank=True, default="", verbose_name="Serial Number")
    system_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="System Qty",
    )
    counted_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Counted Qty",
    )
    variance_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        verbose_name="Variance Qty",
    )
    adjustment_reason = models.ForeignKey(
        InventoryAdjustmentReason,
        on_delete=models.PROTECT,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
        verbose_name="Adjustment Reason",
    )
    status = models.CharField(
        max_length=32,
        choices=CycleCountLineStatus.choices,
        default=CycleCountLineStatus.OPEN,
        verbose_name="Status",
    )
    assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="assigned_cycle_count_lines",
        blank=True,
        null=True,
        verbose_name="Assigned To",
    )
    assigned_at = models.DateTimeField(blank=True, null=True, verbose_name="Assigned At")
    scanner_task_type = models.CharField(
        max_length=16,
        choices=ScannerTaskType.choices,
        default=ScannerTaskType.NONE,
        verbose_name="Scanner Task Type",
    )
    scanner_task_status = models.CharField(
        max_length=16,
        choices=ScannerTaskStatus.choices,
        default=ScannerTaskStatus.UNASSIGNED,
        verbose_name="Scanner Task Status",
    )
    scanner_task_acknowledged_at = models.DateTimeField(blank=True, null=True, verbose_name="Scanner Task Acknowledged At")
    scanner_task_started_at = models.DateTimeField(blank=True, null=True, verbose_name="Scanner Task Started At")
    scanner_task_completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Scanner Task Completed At")
    scanner_task_last_operator = models.CharField(
        max_length=255,
        blank=True,
        default="",
        verbose_name="Scanner Task Last Operator",
    )
    counted_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Counted By")
    counted_at = models.DateTimeField(blank=True, null=True, verbose_name="Counted At")
    recount_assigned_to = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="recount_cycle_count_lines",
        blank=True,
        null=True,
        verbose_name="Recount Assigned To",
    )
    recount_assigned_at = models.DateTimeField(blank=True, null=True, verbose_name="Recount Assigned At")
    recount_counted_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Recounted Qty",
    )
    recounted_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Recounted By")
    recounted_at = models.DateTimeField(blank=True, null=True, verbose_name="Recounted At")
    adjustment_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.PROTECT,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
        verbose_name="Adjustment Movement",
    )
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "counting_cycle_count_line"
        verbose_name = "Cycle Count Line"
        verbose_name_plural = "Cycle Count Lines"
        ordering = ["cycle_count_id", "line_number"]
        constraints = [
            models.UniqueConstraint(
                fields=["cycle_count", "line_number"],
                condition=Q(is_delete=False),
                name="count_line_number_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.cycle_count.count_number}#{self.line_number}"


class CountApproval(TenantAuditModel):
    cycle_count_line = models.OneToOneField(
        CycleCountLine,
        on_delete=models.PROTECT,
        related_name="approval",
        verbose_name="Cycle Count Line",
    )
    approval_rule = models.ForeignKey(
        InventoryAdjustmentApprovalRule,
        on_delete=models.PROTECT,
        related_name="count_approvals",
        blank=True,
        null=True,
        verbose_name="Approval Rule",
    )
    status = models.CharField(
        max_length=32,
        choices=CountApprovalStatus.choices,
        default=CountApprovalStatus.PENDING,
        verbose_name="Status",
    )
    requested_by = models.CharField(max_length=255, verbose_name="Requested By")
    requested_at = models.DateTimeField(default=timezone.now, verbose_name="Requested At")
    approved_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Approved By")
    approved_at = models.DateTimeField(blank=True, null=True, verbose_name="Approved At")
    rejected_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Rejected By")
    rejected_at = models.DateTimeField(blank=True, null=True, verbose_name="Rejected At")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "counting_count_approval"
        verbose_name = "Count Approval"
        verbose_name_plural = "Count Approvals"
        ordering = ["-requested_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.cycle_count_line} {self.status}"
