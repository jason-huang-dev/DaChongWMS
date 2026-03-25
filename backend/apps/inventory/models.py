from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import F
from django.utils import timezone

from apps.locations.models import Location
from apps.organizations.models import Organization
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InventoryStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    QUARANTINE = "QUARANTINE", "Quarantine"
    DAMAGED = "DAMAGED", "Damaged"


class MovementType(models.TextChoices):
    OPENING = "OPENING", "Opening Balance"
    RECEIPT = "RECEIPT", "Receipt"
    PUTAWAY = "PUTAWAY", "Putaway"
    TRANSFER = "TRANSFER", "Transfer"
    PICK = "PICK", "Pick"
    SHIP = "SHIP", "Ship"
    ADJUSTMENT_IN = "ADJUSTMENT_IN", "Adjustment In"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT", "Adjustment Out"
    HOLD = "HOLD", "Hold"
    RELEASE_HOLD = "RELEASE_HOLD", "Release Hold"


class AdjustmentDirection(models.TextChoices):
    INCREASE = "INCREASE", "Increase"
    DECREASE = "DECREASE", "Decrease"
    BOTH = "BOTH", "Both"


class InventoryBalance(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_balances",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="inventory_balances",
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="inventory_balances",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory_balances",
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    on_hand_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    allocated_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    hold_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    currency = models.CharField(max_length=8, default="USD")
    last_movement_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("organization_id", "warehouse_id", "location_id", "product_id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("location", "product", "lot_number", "serial_number", "stock_status"),
                name="unique_inventory_balance_slot",
            ),
            models.CheckConstraint(
                condition=models.Q(on_hand_qty__gte=F("allocated_qty")),
                name="inventory_on_hand_gte_allocated",
            ),
            models.CheckConstraint(
                condition=models.Q(on_hand_qty__gte=F("hold_qty")),
                name="inventory_on_hand_gte_hold",
            ),
        ]
        permissions = [
            ("view_inventory", "Can view inventory"),
            ("manage_inventory_records", "Can manage inventory records"),
            ("manage_inventory_configuration", "Can manage inventory configuration"),
        ]

    @property
    def available_qty(self) -> Decimal:
        return self.on_hand_qty - self.allocated_qty - self.hold_qty

    def clean(self) -> None:
        super().clean()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.currency = self.currency.strip().upper() or "USD"

        errors: dict[str, str] = {}
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the balance."
        if self.location.organization_id != self.organization_id:
            errors["location"] = "Location must belong to the same organization as the balance."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the balance."
        if self.location.warehouse_id != self.warehouse_id:
            errors["location"] = "Location must belong to the same warehouse as the balance."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} @ {self.location.code}"


class InventoryMovement(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_movements",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="inventory_movements",
    )
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="inventory_movements",
    )
    from_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="inventory_movements_out",
        blank=True,
        null=True,
    )
    to_location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="inventory_movements_in",
        blank=True,
        null=True,
    )
    movement_type = models.CharField(
        max_length=32,
        choices=MovementType.choices,
    )
    stock_status = models.CharField(
        max_length=32,
        choices=InventoryStatus.choices,
        default=InventoryStatus.AVAILABLE,
    )
    lot_number = models.CharField(max_length=64, blank=True, default="")
    serial_number = models.CharField(max_length=64, blank=True, default="")
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    unit_cost = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    currency = models.CharField(max_length=8, default="USD")
    reference_code = models.CharField(max_length=64, blank=True, default="")
    reason = models.CharField(max_length=255, blank=True, default="")
    performed_by = models.CharField(max_length=255)
    occurred_at = models.DateTimeField(default=timezone.now)
    resulting_from_qty = models.DecimalField(max_digits=18, decimal_places=4, blank=True, null=True)
    resulting_to_qty = models.DecimalField(max_digits=18, decimal_places=4, blank=True, null=True)

    class Meta:
        ordering = ("organization_id", "-occurred_at", "-id")

    def clean(self) -> None:
        super().clean()
        self.lot_number = self.lot_number.strip()
        self.serial_number = self.serial_number.strip()
        self.reference_code = self.reference_code.strip()
        self.reason = self.reason.strip()
        self.performed_by = self.performed_by.strip()
        self.currency = self.currency.strip().upper() or "USD"

        errors: dict[str, str] = {}
        if not self.performed_by:
            errors["performed_by"] = "Performed by cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the movement."
        if self.product.organization_id != self.organization_id:
            errors["product"] = "Product must belong to the same organization as the movement."
        if self.from_location is not None:
            if self.from_location.organization_id != self.organization_id:
                errors["from_location"] = "Source location must belong to the same organization as the movement."
            if self.from_location.warehouse_id != self.warehouse_id:
                errors["from_location"] = "Source location must belong to the same warehouse as the movement."
        if self.to_location is not None:
            if self.to_location.organization_id != self.organization_id:
                errors["to_location"] = "Destination location must belong to the same organization as the movement."
            if self.to_location.warehouse_id != self.warehouse_id:
                errors["to_location"] = "Destination location must belong to the same warehouse as the movement."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.movement_type} {self.product.sku} {self.quantity}"


class InventoryHold(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_holds",
    )
    inventory_balance = models.ForeignKey(
        InventoryBalance,
        on_delete=models.CASCADE,
        related_name="holds",
    )
    quantity = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        validators=[MinValueValidator(Decimal("0.0001"))],
    )
    reason = models.CharField(max_length=255)
    reference_code = models.CharField(max_length=64, blank=True, default="")
    notes = models.TextField(blank=True, default="")
    held_by = models.CharField(max_length=255)
    released_by = models.CharField(max_length=255, blank=True, default="")
    released_at = models.DateTimeField(blank=True, null=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "-id")

    def clean(self) -> None:
        super().clean()
        self.reason = self.reason.strip()
        self.reference_code = self.reference_code.strip()
        self.notes = self.notes.strip()
        self.held_by = self.held_by.strip()
        self.released_by = self.released_by.strip()

        errors: dict[str, str] = {}
        if not self.reason:
            errors["reason"] = "Hold reason cannot be blank."
        if not self.held_by:
            errors["held_by"] = "Held by cannot be blank."
        if self.inventory_balance.organization_id != self.organization_id:
            errors["inventory_balance"] = "Inventory balance must belong to the same organization as the hold."
        if not self.is_active and self.released_at is None:
            self.released_at = timezone.now()
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.inventory_balance.product.sku} hold {self.quantity}"


class InventoryAdjustmentReason(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_adjustment_reasons",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    direction = models.CharField(
        max_length=32,
        choices=AdjustmentDirection.choices,
        default=AdjustmentDirection.BOTH,
    )
    requires_approval = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_adjustment_reason_code_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.description = self.description.strip()
        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Adjustment reason code cannot be blank."
        if not self.name:
            errors["name"] = "Adjustment reason name cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization.slug} / {self.code}"


class InventoryAdjustmentApprovalRule(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="inventory_adjustment_approval_rules",
    )
    adjustment_reason = models.ForeignKey(
        InventoryAdjustmentReason,
        on_delete=models.CASCADE,
        related_name="approval_rules",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="inventory_adjustment_approval_rules",
        blank=True,
        null=True,
    )
    minimum_variance_qty = models.DecimalField(
        max_digits=18,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    approver_role = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "adjustment_reason_id", "-minimum_variance_qty", "approver_role", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "adjustment_reason", "warehouse", "minimum_variance_qty", "approver_role"),
                name="unique_inventory_adjustment_approval_rule",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.approver_role = self.approver_role.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.approver_role:
            errors["approver_role"] = "Approver role cannot be blank."
        if self.adjustment_reason.organization_id != self.organization_id:
            errors["adjustment_reason"] = "Adjustment reason must belong to the same organization as the rule."
        if self.warehouse is not None and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the rule."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.adjustment_reason.code} / {self.approver_role}"

