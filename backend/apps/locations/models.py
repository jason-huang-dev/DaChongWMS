from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.utils import timezone

from apps.organizations.models import Organization
from apps.warehouse.models import Warehouse


class ZoneUsage(models.TextChoices):
    RECEIVING = "RECEIVING", "Receiving"
    STORAGE = "STORAGE", "Storage"
    PICKING = "PICKING", "Picking"
    SHIPPING = "SHIPPING", "Shipping"
    QUARANTINE = "QUARANTINE", "Quarantine"
    RETURNS = "RETURNS", "Returns"


class LocationStatus(models.TextChoices):
    AVAILABLE = "AVAILABLE", "Available"
    BLOCKED = "BLOCKED", "Blocked"
    MAINTENANCE = "MAINTENANCE", "Maintenance"


class Zone(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="zones",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="zones",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    usage = models.CharField(
        max_length=32,
        choices=ZoneUsage.choices,
        default=ZoneUsage.STORAGE,
    )
    sequence = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "warehouse_id", "sequence", "code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("warehouse", "code"),
                name="unique_zone_code_per_warehouse",
            ),
            models.UniqueConstraint(
                fields=("warehouse", "name"),
                name="unique_zone_name_per_warehouse",
            ),
        ]
        permissions = [
            ("manage_location_topology", "Can manage location topology"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Zone code cannot be blank."
        if not self.name:
            errors["name"] = "Zone name cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the zone."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.warehouse.code} / {self.code}"


class LocationType(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="location_types",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    picking_enabled = models.BooleanField(default=True)
    putaway_enabled = models.BooleanField(default=True)
    allow_mixed_sku = models.BooleanField(default=False)
    max_weight = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    max_volume = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_location_type_code_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Location type code cannot be blank."
        if not self.name:
            errors["name"] = "Location type name cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization.slug} / {self.code}"


class Location(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    zone = models.ForeignKey(
        Zone,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    location_type = models.ForeignKey(
        LocationType,
        on_delete=models.CASCADE,
        related_name="locations",
    )
    code = models.CharField(max_length=64)
    name = models.CharField(max_length=255, blank=True, default="")
    aisle = models.CharField(max_length=64, blank=True, default="")
    bay = models.CharField(max_length=64, blank=True, default="")
    level = models.CharField(max_length=64, blank=True, default="")
    slot = models.CharField(max_length=64, blank=True, default="")
    barcode = models.CharField(max_length=255, blank=True, default="")
    capacity_qty = models.PositiveIntegerField(default=0)
    max_weight = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
    )
    max_volume = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
    )
    pick_sequence = models.PositiveIntegerField(default=0)
    is_pick_face = models.BooleanField(default=False)
    is_locked = models.BooleanField(default=False)
    status = models.CharField(
        max_length=32,
        choices=LocationStatus.choices,
        default=LocationStatus.AVAILABLE,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "warehouse_id", "pick_sequence", "code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("warehouse", "code"),
                name="unique_location_code_per_warehouse",
            ),
        ]
        permissions = [
            ("view_locations", "Can view location topology"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip() or self.code
        self.aisle = self.aisle.strip()
        self.bay = self.bay.strip()
        self.level = self.level.strip()
        self.slot = self.slot.strip()
        self.barcode = self.barcode.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Location code cannot be blank."
        if self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization as the location."
        if self.zone.organization_id != self.organization_id:
            errors["zone"] = "Zone must belong to the same organization as the location."
        if self.location_type.organization_id != self.organization_id:
            errors["location_type"] = "Location type must belong to the same organization as the location."
        if self.zone.warehouse_id != self.warehouse_id:
            errors["zone"] = "Zone must belong to the same warehouse as the location."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.warehouse.code} / {self.code}"


class LocationLock(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="location_locks",
    )
    location = models.ForeignKey(
        Location,
        on_delete=models.CASCADE,
        related_name="locks",
    )
    reason = models.CharField(max_length=255)
    notes = models.TextField(blank=True, default="")
    locked_by = models.CharField(max_length=255)
    released_by = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)
    start_time = models.DateTimeField(default=timezone.now)
    end_time = models.DateTimeField(blank=True, null=True)
    released_at = models.DateTimeField(blank=True, null=True)

    class Meta:
        ordering = ("organization_id", "-start_time", "-id")
        constraints = [
            models.UniqueConstraint(
                fields=("location",),
                condition=models.Q(is_active=True),
                name="unique_active_location_lock_per_location",
            ),
        ]
        permissions = [
            ("manage_location_locks", "Can manage location locks"),
        ]

    def clean(self) -> None:
        super().clean()
        self.reason = self.reason.strip()
        self.notes = self.notes.strip()
        self.locked_by = self.locked_by.strip()
        self.released_by = self.released_by.strip()

        errors: dict[str, str] = {}
        if not self.reason:
            errors["reason"] = "Lock reason cannot be blank."
        if not self.locked_by:
            errors["locked_by"] = "Locked by cannot be blank."
        if self.location.organization_id != self.organization_id:
            errors["location"] = "Location must belong to the same organization as the lock."
        if not self.is_active and self.end_time is None:
            self.end_time = timezone.now()
        if not self.is_active and self.released_at is None:
            self.released_at = timezone.now()
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.location.code} / {self.reason}"

