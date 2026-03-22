from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount


class Product(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="products",
    )
    sku = models.CharField(max_length=64)
    name = models.CharField(max_length=255)
    barcode = models.CharField(max_length=128, blank=True, default="")
    unit_of_measure = models.CharField(max_length=32, blank=True, default="EA")
    category = models.CharField(max_length=100, blank=True, default="")
    brand = models.CharField(max_length=100, blank=True, default="")
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "sku", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "sku"),
                name="unique_product_sku_per_organization",
            ),
        ]
        permissions = [
            ("manage_products", "Can manage products"),
        ]

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.sku = self.sku.strip().upper()
        self.barcode = self.barcode.strip()
        self.unit_of_measure = self.unit_of_measure.strip().upper() or "EA"
        self.category = self.category.strip()
        self.brand = self.brand.strip()
        self.description = self.description.strip()

        errors: dict[str, str] = {}
        if not self.name:
            errors["name"] = "Product name cannot be blank."
        if not self.sku:
            errors["sku"] = "Product SKU cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.sku} / {self.name}"


class DistributionProduct(models.Model):
    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="distribution_products",
    )
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="distribution_products",
    )
    external_sku = models.CharField(max_length=64)
    external_name = models.CharField(max_length=255, blank=True, default="")
    channel_name = models.CharField(max_length=100, blank=True, default="")
    allow_dropshipping_orders = models.BooleanField(default=True)
    allow_inbound_goods = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("product_id", "customer_account_id", "external_sku", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("product", "customer_account", "external_sku"),
                name="unique_distribution_product_per_customer_sku",
            ),
        ]
        permissions = [
            ("manage_distribution_products", "Can manage distribution products"),
        ]

    def clean(self) -> None:
        super().clean()
        self.external_sku = self.external_sku.strip().upper()
        self.external_name = self.external_name.strip() or self.product.name
        self.channel_name = self.channel_name.strip()

        errors: dict[str, str] = {}
        if not self.external_sku:
            errors["external_sku"] = "Distribution SKU cannot be blank."
        if self.product.organization_id != self.customer_account.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization as the product."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} / {self.customer_account.code} / {self.external_sku}"


class ProductSerialConfig(models.Model):
    class TrackingMode(models.TextChoices):
        NONE = "NONE", "None"
        OPTIONAL = "OPTIONAL", "Optional"
        REQUIRED = "REQUIRED", "Required"

    product = models.OneToOneField(
        Product,
        on_delete=models.CASCADE,
        related_name="serial_config",
    )
    tracking_mode = models.CharField(
        max_length=20,
        choices=TrackingMode.choices,
        default=TrackingMode.NONE,
    )
    serial_pattern = models.CharField(max_length=255, blank=True, default="")
    requires_uniqueness = models.BooleanField(default=True)
    capture_on_inbound = models.BooleanField(default=False)
    capture_on_outbound = models.BooleanField(default=False)
    capture_on_returns = models.BooleanField(default=False)

    class Meta:
        permissions = [
            ("manage_serial_management", "Can manage product serial configuration"),
        ]

    def clean(self) -> None:
        super().clean()
        self.serial_pattern = self.serial_pattern.strip()
        if self.tracking_mode == self.TrackingMode.NONE and self.serial_pattern:
            raise ValidationError({"serial_pattern": "Serial pattern requires optional or required tracking."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} serial config"


class ProductPackaging(models.Model):
    class PackageType(models.TextChoices):
        UNIT = "UNIT", "Unit"
        INNER = "INNER", "Inner Pack"
        CARTON = "CARTON", "Carton"
        PALLET = "PALLET", "Pallet"
        CUSTOM = "CUSTOM", "Custom"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="packaging_options",
    )
    package_type = models.CharField(
        max_length=20,
        choices=PackageType.choices,
        default=PackageType.UNIT,
    )
    package_code = models.CharField(max_length=50)
    units_per_package = models.PositiveIntegerField(default=1)
    length_cm = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    width_cm = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    height_cm = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("product_id", "-is_default", "package_code", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("product", "package_code"),
                name="unique_product_packaging_code",
            ),
        ]
        permissions = [
            ("manage_packaging", "Can manage product packaging"),
        ]

    def clean(self) -> None:
        super().clean()
        self.package_code = self.package_code.strip().upper()
        if not self.package_code:
            raise ValidationError({"package_code": "Package code cannot be blank."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} / {self.package_code}"


class ProductMark(models.Model):
    class MarkType(models.TextChoices):
        FRAGILE = "FRAGILE", "Fragile"
        BATTERY = "BATTERY", "Battery"
        TEMPERATURE = "TEMPERATURE", "Temperature Controlled"
        LABEL = "LABEL", "Label"
        CUSTOM = "CUSTOM", "Custom"

    product = models.ForeignKey(
        Product,
        on_delete=models.CASCADE,
        related_name="marks",
    )
    mark_type = models.CharField(
        max_length=20,
        choices=MarkType.choices,
        default=MarkType.CUSTOM,
    )
    value = models.CharField(max_length=255)
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("product_id", "mark_type", "value", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("product", "mark_type", "value"),
                name="unique_product_mark_value",
            ),
        ]
        permissions = [
            ("manage_product_marks", "Can manage product marks"),
        ]

    def clean(self) -> None:
        super().clean()
        self.value = self.value.strip()
        self.notes = self.notes.strip()
        if not self.value:
            raise ValidationError({"value": "Mark value cannot be blank."})

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.product.sku} / {self.mark_type} / {self.value}"
