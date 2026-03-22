from __future__ import annotations

from datetime import timedelta
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.warehouse.models import Warehouse


class WorkOrderType(models.Model):
    class Workstream(models.TextChoices):
        INBOUND = "INBOUND", "Inbound"
        OUTBOUND = "OUTBOUND", "Outbound"
        INVENTORY = "INVENTORY", "Inventory"
        RETURNS = "RETURNS", "Returns"
        GENERAL = "GENERAL", "General"

    class Urgency(models.TextChoices):
        LOW = "LOW", "Low"
        MEDIUM = "MEDIUM", "Medium"
        HIGH = "HIGH", "High"
        CRITICAL = "CRITICAL", "Critical"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="work_order_types",
    )
    code = models.SlugField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    workstream = models.CharField(
        max_length=20,
        choices=Workstream.choices,
        default=Workstream.GENERAL,
    )
    default_urgency = models.CharField(
        max_length=20,
        choices=Urgency.choices,
        default=Urgency.MEDIUM,
    )
    default_priority_score = models.PositiveSmallIntegerField(
        default=50,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    target_sla_hours = models.PositiveSmallIntegerField(
        default=24,
        validators=[MinValueValidator(1), MaxValueValidator(720)],
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "workstream", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_work_order_type_code_per_organization",
            ),
        ]
        permissions = [
            ("manage_work_order_types", "Can manage work order types"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().lower()
        self.name = self.name.strip()
        self.description = self.description.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Work order type code cannot be blank."
        if not self.name:
            errors["name"] = "Work order type name cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization} / {self.name}"


class WorkOrder(models.Model):
    class Status(models.TextChoices):
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        READY = "READY", "Ready"
        SCHEDULED = "SCHEDULED", "Scheduled"
        IN_PROGRESS = "IN_PROGRESS", "In progress"
        BLOCKED = "BLOCKED", "Blocked"
        COMPLETED = "COMPLETED", "Completed"
        CANCELLED = "CANCELLED", "Cancelled"

    class SlaStatus(models.TextChoices):
        UNSCHEDULED = "UNSCHEDULED", "Unscheduled"
        ON_TRACK = "ON_TRACK", "On track"
        DUE_SOON = "DUE_SOON", "Due soon"
        OVERDUE = "OVERDUE", "Overdue"
        COMPLETED = "COMPLETED", "Completed"

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="work_orders",
    )
    work_order_type = models.ForeignKey(
        WorkOrderType,
        on_delete=models.PROTECT,
        related_name="work_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="work_orders",
        null=True,
        blank=True,
    )
    title = models.CharField(max_length=255)
    source_reference = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING_REVIEW,
    )
    urgency = models.CharField(
        max_length=20,
        choices=WorkOrderType.Urgency.choices,
        default=WorkOrderType.Urgency.MEDIUM,
    )
    priority_score = models.PositiveSmallIntegerField(
        default=50,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    assignee_name = models.CharField(max_length=255, blank=True, default="")
    scheduled_start_at = models.DateTimeField(null=True, blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    estimated_duration_minutes = models.PositiveIntegerField(default=0)
    notes = models.TextField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-priority_score", "due_at", "id")
        permissions = [
            ("manage_work_orders", "Can manage work orders"),
        ]

    def clean(self) -> None:
        super().clean()
        self.title = self.title.strip()
        self.source_reference = self.source_reference.strip().upper()
        self.assignee_name = self.assignee_name.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.title:
            errors["title"] = "Work order title cannot be blank."
        if self.work_order_type.organization_id != self.organization_id:
            errors["work_order_type"] = "Work order type must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.scheduled_start_at and self.due_at and self.due_at < self.scheduled_start_at:
            errors["due_at"] = "Due time cannot be earlier than the scheduled start."
        if self.started_at and self.completed_at and self.completed_at < self.started_at:
            errors["completed_at"] = "Completed time cannot be earlier than the started time."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_code(self) -> str:
        return f"WO-{self.id:05d}" if self.id else "WO-NEW"

    @property
    def sla_status(self) -> str:
        if self.status in {self.Status.COMPLETED, self.Status.CANCELLED}:
            return self.SlaStatus.COMPLETED
        if self.due_at is None:
            return self.SlaStatus.UNSCHEDULED

        now = timezone.now()
        if self.due_at <= now:
            return self.SlaStatus.OVERDUE
        if self.due_at <= now + timedelta(hours=12):
            return self.SlaStatus.DUE_SOON
        return self.SlaStatus.ON_TRACK

    def __str__(self) -> str:
        return f"{self.display_code} / {self.title}"
