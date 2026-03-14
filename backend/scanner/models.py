"""Barcode aliases, scan rules, and license-plate tracking."""

from __future__ import annotations

from decimal import Decimal

from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q


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
