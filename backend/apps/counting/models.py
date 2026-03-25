from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models

from apps.inventory.models import InventoryAdjustmentApprovalRule, InventoryAdjustmentReason, InventoryBalance, InventoryMovement, InventoryStatus
from apps.locations.models import Location
from apps.organizations.models import Organization, OrganizationMembership
from apps.products.models import Product
from apps.warehouse.models import Warehouse


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


class CycleCount(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="cycle_counts",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="cycle_counts",
    )
    count_number = models.CharField(max_length=64)
    scheduled_date = models.DateField(blank=True, null=True)
    is_blind_count = models.BooleanField(default=False)
    status = models.CharField(
        max_length=32,
        choices=CycleCountStatus.choices,
        default=CycleCountStatus.OPEN,
    )
    notes = models.TextField(blank=True, default="")
    submitted_by = models.CharField(max_length=255, blank=True, default="")
    submitted_at = models.DateTimeField(blank=True, null=True)
    completed_at = models.DateTimeField(blank=True, null=True)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "count_number"),
                name="unique_cycle_count_number_per_organization",
            ),
        ]
        permissions = [
            ("view_counting", "Can view counting operations"),
            ("manage_counting", "Can manage counting operations"),
        ]

    def clean(self) -> None:
        super().clean()
        self.count_number = self.count_number.strip().upper()
        self.notes = self.notes.strip()
        self.submitted_by = self.submitted_by.strip()

        errors: dict[str, str] = {}
        if not self.count_number:
            errors["count_number"] = "Count number cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the cycle count."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.count_number


class CycleCountLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="cycle_count_lines",
    )
    cycle_count = models.ForeignKey(
        CycleCount,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    inventory_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.SET_NULL,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="cycle_count_lines",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="cycle_count_lines",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    system_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    counted_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    variance_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
    )
    adjustment_reason = models.ForeignKey(
        InventoryAdjustmentReason,
        on_delete=models.SET_NULL,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=32,
        choices=CycleCountLineStatus.choices,
        default=CycleCountLineStatus.OPEN,
    )
    assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="assigned_cycle_count_lines",
        blank=True,
        null=True,
    )
    assigned_at = models.DateTimeField(blank=True, null=True)
    scanner_task_type = models.CharField(
        max_length=16,
        choices=ScannerTaskType.choices,
        default=ScannerTaskType.NONE,
    )
    scanner_task_status = models.CharField(
        max_length=16,
        choices=ScannerTaskStatus.choices,
        default=ScannerTaskStatus.UNASSIGNED,
    )
    scanner_task_acknowledged_at = models.DateTimeField(blank=True, null=True)
    scanner_task_started_at = models.DateTimeField(blank=True, null=True)
    scanner_task_completed_at = models.DateTimeField(blank=True, null=True)
    scanner_task_last_operator = models.CharField(max_length=255, blank=True, default="")
    counted_by = models.CharField(max_length=255, blank=True, default="")
    counted_at = models.DateTimeField(blank=True, null=True)
    recount_assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="recount_cycle_count_lines",
        blank=True,
        null=True,
    )
    recount_assigned_at = models.DateTimeField(blank=True, null=True)
    recount_counted_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        blank=True,
        null=True,
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    recounted_by = models.CharField(max_length=255, blank=True, default="")
    recounted_at = models.DateTimeField(blank=True, null=True)
    adjustment_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="cycle_count_lines",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "cycle_count_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("cycle_count", "line_number"),
                name="unique_cycle_count_line_number_per_count",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.scanner_task_last_operator = self.scanner_task_last_operator.strip()
        self.counted_by = self.counted_by.strip()
        self.recounted_by = self.recounted_by.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.cycle_count.organization_id != self.organization_id:
            errors["cycle_count"] = "Cycle count must belong to the same organization as the line."
        if self.location.organization_id != self.organization_id:
            errors["location"] = "Location must belong to the same organization as the line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the line."
        if self.location.warehouse_id != self.cycle_count.warehouse_id:
            errors["location"] = "Location must belong to the same warehouse as the cycle count."
        if self.inventory_balance is not None:
            if self.inventory_balance.organization_id != self.organization_id:
                errors["inventory_balance"] = "Inventory balance must belong to the same organization as the line."
            if self.inventory_balance.warehouse_id != self.cycle_count.warehouse_id:
                errors["inventory_balance"] = "Inventory balance must belong to the same warehouse as the cycle count."
        if self.adjustment_reason is not None and self.adjustment_reason.organization_id != self.organization_id:
            errors["adjustment_reason"] = "Adjustment reason must belong to the same organization as the line."
        if self.assigned_membership is not None and self.assigned_membership.organization_id != self.organization_id:
            errors["assigned_membership"] = "Assigned membership must belong to the same organization as the line."
        if self.recount_assigned_membership is not None and self.recount_assigned_membership.organization_id != self.organization_id:
            errors["recount_assigned_membership"] = "Recount membership must belong to the same organization as the line."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.cycle_count.count_number}#{self.line_number}"


class CountApproval(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="count_approvals",
    )
    cycle_count_line = models.OneToOneField(
        CycleCountLine,
        on_delete=models.CASCADE,
        related_name="approval",
    )
    approval_rule = models.ForeignKey(
        InventoryAdjustmentApprovalRule,
        on_delete=models.SET_NULL,
        related_name="count_approvals",
        blank=True,
        null=True,
    )
    status = models.CharField(
        max_length=32,
        choices=CountApprovalStatus.choices,
        default=CountApprovalStatus.PENDING,
    )
    requested_by = models.CharField(max_length=255, blank=True, default="")
    requested_at = models.DateTimeField(blank=True, null=True)
    approved_by = models.CharField(max_length=255, blank=True, default="")
    approved_at = models.DateTimeField(blank=True, null=True)
    rejected_by = models.CharField(max_length=255, blank=True, default="")
    rejected_at = models.DateTimeField(blank=True, null=True)
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-requested_at", "-id")
        permissions = [
            ("manage_count_approvals", "Can manage counting approvals"),
        ]

    def clean(self) -> None:
        super().clean()
        self.requested_by = self.requested_by.strip()
        self.approved_by = self.approved_by.strip()
        self.rejected_by = self.rejected_by.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.cycle_count_line.organization_id != self.organization_id:
            errors["cycle_count_line"] = "Count approval must belong to the same organization as the count line."
        if self.approval_rule is not None and self.approval_rule.organization_id != self.organization_id:
            errors["approval_rule"] = "Approval rule must belong to the same organization as the count approval."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"Approval {self.cycle_count_line}"

