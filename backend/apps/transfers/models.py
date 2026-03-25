from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.inventory.models import InventoryBalance, InventoryMovement, InventoryStatus
from apps.locations.models import Location
from apps.organizations.models import Organization, OrganizationMembership
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class TransferOrderStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    IN_PROGRESS = "IN_PROGRESS", "In Progress"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class TransferLineStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class ReplenishmentTaskStatus(models.TextChoices):
    OPEN = "OPEN", "Open"
    ASSIGNED = "ASSIGNED", "Assigned"
    COMPLETED = "COMPLETED", "Completed"
    CANCELLED = "CANCELLED", "Cancelled"


class TransferOrder(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="transfer_orders",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="transfer_orders",
    )
    transfer_number = models.CharField(max_length=64)
    requested_date = models.DateField(blank=True, null=True)
    reference_code = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=TransferOrderStatus.choices,
        default=TransferOrderStatus.OPEN,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "-create_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "transfer_number"),
                name="unique_transfer_order_number_per_organization",
            ),
        ]
        permissions = [
            ("view_transfers", "Can view transfer operations"),
            ("manage_transfer_orders", "Can manage transfer orders"),
        ]

    def clean(self) -> None:
        super().clean()
        self.transfer_number = self.transfer_number.strip().upper()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if not self.transfer_number:
            errors["transfer_number"] = "Transfer number cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the transfer order."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.transfer_number


class TransferLine(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="transfer_lines",
    )
    transfer_order = models.ForeignKey(
        TransferOrder,
        on_delete=models.CASCADE,
        related_name="lines",
    )
    line_number = models.PositiveIntegerField()
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="transfer_lines",
    )
    from_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="transfer_lines_from",
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="transfer_lines_to",
    )
    requested_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    moved_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=TransferLineStatus.choices,
        default=TransferLineStatus.OPEN,
    )
    assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="assigned_transfer_lines",
        blank=True,
        null=True,
    )
    completed_by = models.CharField(max_length=255, blank=True, default="")
    completed_at = models.DateTimeField(blank=True, null=True)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="transfer_lines",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "transfer_order_id", "line_number", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("transfer_order", "line_number"),
                name="unique_transfer_line_number_per_order",
            ),
            models.CheckConstraint(
                condition=models.Q(requested_qty__gte=F("moved_qty")),
                name="transfer_requested_qty_gte_moved_qty",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.completed_by = self.completed_by.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if self.transfer_order.organization_id != self.organization_id:
            errors["transfer_order"] = "Transfer order must belong to the same organization as the line."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the line."
        if self.from_location.organization_id != self.organization_id:
            errors["from_location"] = "Source location must belong to the same organization as the line."
        if self.to_location.organization_id != self.organization_id:
            errors["to_location"] = "Destination location must belong to the same organization as the line."
        if self.from_location.warehouse_id != self.transfer_order.warehouse_id:
            errors["from_location"] = "Source location must belong to the same warehouse as the transfer order."
        if self.to_location.warehouse_id != self.transfer_order.warehouse_id:
            errors["to_location"] = "Destination location must belong to the same warehouse as the transfer order."
        if self.assigned_membership is not None and self.assigned_membership.organization_id != self.organization_id:
            errors["assigned_membership"] = "Assigned membership must belong to the same organization as the line."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.transfer_order.transfer_number}#{self.line_number}"


class ReplenishmentRule(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="replenishment_rules",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="replenishment_rules",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="replenishment_rules",
    )
    source_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="replenishment_rules_source",
    )
    target_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="replenishment_rules_target",
    )
    minimum_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    target_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    priority = models.PositiveIntegerField(default=100)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "priority", "warehouse_id", "target_location_id", "product_id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "warehouse", "product", "source_location", "target_location", "stock_status"),
                name="unique_replenishment_rule_definition",
            ),
            models.CheckConstraint(
                condition=models.Q(target_qty__gt=F("minimum_qty")),
                name="replenishment_target_qty_gt_minimum_qty",
            ),
        ]
        permissions = [
            ("manage_replenishment", "Can manage replenishment rules and tasks"),
        ]

    def clean(self) -> None:
        super().clean()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the rule."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the rule."
        if self.source_location.organization_id != self.organization_id:
            errors["source_location"] = "Source location must belong to the same organization as the rule."
        if self.target_location.organization_id != self.organization_id:
            errors["target_location"] = "Target location must belong to the same organization as the rule."
        if self.source_location.warehouse_id != self.warehouse_id:
            errors["source_location"] = "Source location must belong to the same warehouse as the rule."
        if self.target_location.warehouse_id != self.warehouse_id:
            errors["target_location"] = "Target location must belong to the same warehouse as the rule."
        if self.source_location_id == self.target_location_id:
            errors["target_location"] = "Target location must be different from source location."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} {self.source_location.code}->{self.target_location.code}"


class ReplenishmentTask(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks",
    )
    replenishment_rule = models.ForeignKey(
        ReplenishmentRule,
        on_delete=models.SET_NULL,
        related_name="tasks",
        blank=True,
        null=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks",
    )
    source_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks",
    )
    task_number = models.CharField(max_length=64)
    from_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks_from",
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="replenishment_tasks_to",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    priority = models.PositiveIntegerField(default=100)
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    status = models.CharField(
        max_length=32,
        choices=ReplenishmentTaskStatus.choices,
        default=ReplenishmentTaskStatus.OPEN,
    )
    assigned_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="assigned_replenishment_tasks",
        blank=True,
        null=True,
    )
    completed_by = models.CharField(max_length=255, blank=True, default="")
    completed_at = models.DateTimeField(blank=True, null=True)
    inventory_movement = models.ForeignKey(
        InventoryMovement,
        on_delete=models.SET_NULL,
        related_name="replenishment_tasks",
        blank=True,
        null=True,
    )
    notes = models.TextField(blank=True, default="")
    generated_at = models.DateTimeField(default=timezone.now)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "status", "priority", "generated_at", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "task_number"),
                name="unique_replenishment_task_number_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.task_number = self.task_number.strip().upper()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.completed_by = self.completed_by.strip()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if not self.task_number:
            errors["task_number"] = "Task number cannot be blank."
        if self.replenishment_rule is not None and self.replenishment_rule.organization_id != self.organization_id:
            errors["replenishment_rule"] = "Replenishment rule must belong to the same organization as the task."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the task."
        if self.source_balance.organization_id != self.organization_id:
            errors["source_balance"] = "Source balance must belong to the same organization as the task."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the task."
        if self.from_location.organization_id != self.organization_id:
            errors["from_location"] = "Source location must belong to the same organization as the task."
        if self.to_location.organization_id != self.organization_id:
            errors["to_location"] = "Destination location must belong to the same organization as the task."
        if self.from_location.warehouse_id != self.warehouse_id:
            errors["from_location"] = "Source location must belong to the same warehouse as the task."
        if self.to_location.warehouse_id != self.warehouse_id:
            errors["to_location"] = "Destination location must belong to the same warehouse as the task."
        if self.source_balance.location_id != self.from_location_id:
            errors["source_balance"] = "Source balance must belong to the selected source location."
        if self.source_balance.product_id != self.product_id:
            errors["product"] = "Task product must match the selected source balance."
        if self.assigned_membership is not None and self.assigned_membership.organization_id != self.organization_id:
            errors["assigned_membership"] = "Assigned membership must belong to the same organization as the task."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.task_number

