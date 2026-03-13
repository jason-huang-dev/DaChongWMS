"""Location topology models for warehouse operations."""

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


class Zone(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="zones",
        verbose_name="Warehouse",
    )
    zone_code = models.CharField(max_length=64, verbose_name="Zone Code")
    zone_name = models.CharField(max_length=255, verbose_name="Zone Name")
    usage = models.CharField(
        max_length=32,
        choices=ZoneUsage.choices,
        default=ZoneUsage.STORAGE,
        verbose_name="Zone Usage",
    )
    sequence = models.PositiveIntegerField(default=0, verbose_name="Sequence")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")

    class Meta:
        db_table = "location_zone"
        verbose_name = "Zone"
        verbose_name_plural = "Zones"
        ordering = ["warehouse_id", "sequence", "zone_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "warehouse", "zone_code"],
                condition=Q(is_delete=False),
                name="loc_zone_code_uq",
            ),
            models.UniqueConstraint(
                fields=["openid", "warehouse", "zone_name"],
                condition=Q(is_delete=False),
                name="loc_zone_name_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.zone_code} ({self.warehouse.warehouse_name})"


class LocationType(TenantAuditModel):
    type_code = models.CharField(max_length=64, verbose_name="Location Type Code")
    type_name = models.CharField(max_length=255, verbose_name="Location Type Name")
    picking_enabled = models.BooleanField(default=True, verbose_name="Picking Enabled")
    putaway_enabled = models.BooleanField(default=True, verbose_name="Putaway Enabled")
    allow_mixed_sku = models.BooleanField(default=False, verbose_name="Allow Mixed SKU")
    max_weight = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Max Weight",
    )
    max_volume = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Max Volume",
    )

    class Meta:
        db_table = "location_type"
        verbose_name = "Location Type"
        verbose_name_plural = "Location Types"
        ordering = ["type_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "type_code"],
                condition=Q(is_delete=False),
                name="loc_type_code_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.type_code


class Location(TenantAuditModel):
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="locations",
        verbose_name="Warehouse",
    )
    zone = models.ForeignKey(
        "locations.Zone",
        on_delete=models.PROTECT,
        related_name="locations",
        verbose_name="Zone",
    )
    location_type = models.ForeignKey(
        "locations.LocationType",
        on_delete=models.PROTECT,
        related_name="locations",
        verbose_name="Location Type",
    )
    location_code = models.CharField(max_length=64, verbose_name="Location Code")
    location_name = models.CharField(max_length=255, blank=True, default="", verbose_name="Location Name")
    aisle = models.CharField(max_length=64, blank=True, default="", verbose_name="Aisle")
    bay = models.CharField(max_length=64, blank=True, default="", verbose_name="Bay")
    level = models.CharField(max_length=64, blank=True, default="", verbose_name="Level")
    slot = models.CharField(max_length=64, blank=True, default="", verbose_name="Slot")
    barcode = models.CharField(max_length=255, blank=True, default="", verbose_name="Barcode")
    capacity_qty = models.PositiveIntegerField(default=0, verbose_name="Capacity Qty")
    max_weight = models.DecimalField(
        max_digits=12,
        decimal_places=2,
        default=Decimal("0.00"),
        validators=[MinValueValidator(Decimal("0.00"))],
        verbose_name="Max Weight",
    )
    max_volume = models.DecimalField(
        max_digits=12,
        decimal_places=4,
        default=Decimal("0.0000"),
        validators=[MinValueValidator(Decimal("0.0000"))],
        verbose_name="Max Volume",
    )
    pick_sequence = models.PositiveIntegerField(default=0, verbose_name="Pick Sequence")
    is_pick_face = models.BooleanField(default=False, verbose_name="Is Pick Face")
    is_locked = models.BooleanField(default=False, verbose_name="Is Locked")
    status = models.CharField(
        max_length=32,
        choices=LocationStatus.choices,
        default=LocationStatus.AVAILABLE,
        verbose_name="Status",
    )

    class Meta:
        db_table = "location"
        verbose_name = "Location"
        verbose_name_plural = "Locations"
        ordering = ["warehouse_id", "zone_id", "pick_sequence", "location_code"]
        constraints = [
            models.UniqueConstraint(
                fields=["openid", "warehouse", "location_code"],
                condition=Q(is_delete=False),
                name="loc_code_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.location_code


class LocationLock(TenantAuditModel):
    location = models.ForeignKey(
        "locations.Location",
        on_delete=models.PROTECT,
        related_name="locks",
        verbose_name="Location",
    )
    reason = models.CharField(max_length=255, verbose_name="Lock Reason")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")
    locked_by = models.CharField(max_length=255, verbose_name="Locked By")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    start_time = models.DateTimeField(default=timezone.now, verbose_name="Start Time")
    end_time = models.DateTimeField(blank=True, null=True, verbose_name="End Time")

    class Meta:
        db_table = "location_lock"
        verbose_name = "Location Lock"
        verbose_name_plural = "Location Locks"
        ordering = ["-start_time", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["location"],
                condition=Q(is_active=True, is_delete=False),
                name="loc_lock_one_active_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.location.location_code}: {self.reason}"
