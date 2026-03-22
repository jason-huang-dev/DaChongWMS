from __future__ import annotations

from decimal import Decimal
from typing import Any

from django.core.exceptions import ValidationError
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.warehouse.models import Warehouse


ZERO_DECIMAL = Decimal("0.00")


class OrganizationScopedModel(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class LogisticsProvider(OrganizationScopedModel):
    class ProviderType(models.TextChoices):
        CARRIER = "CARRIER", "Carrier"
        AGGREGATOR = "AGGREGATOR", "Aggregator"
        FORWARDER = "FORWARDER", "Forwarder"
        IN_HOUSE = "IN_HOUSE", "In-house"

    class IntegrationMode(models.TextChoices):
        ONLINE = "ONLINE", "Online"
        OFFLINE = "OFFLINE", "Offline"
        HYBRID = "HYBRID", "Hybrid"

    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    provider_type = models.CharField(max_length=20, choices=ProviderType.choices, default=ProviderType.CARRIER)
    integration_mode = models.CharField(
        max_length=20,
        choices=IntegrationMode.choices,
        default=IntegrationMode.HYBRID,
    )
    contact_name = models.CharField(max_length=255, blank=True, default="")
    contact_email = models.EmailField(blank=True, default="")
    contact_phone = models.CharField(max_length=64, blank=True, default="")
    account_number = models.CharField(max_length=100, blank=True, default="")
    api_base_url = models.URLField(blank=True, default="")
    tracking_base_url = models.URLField(blank=True, default="")
    supports_online_booking = models.BooleanField(default=True)
    supports_offline_booking = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_logistics_provider_code_per_organization",
            ),
        ]
        permissions = [
            ("view_logistics", "Can view logistics workspace"),
            ("manage_logistics_providers", "Can manage logistics providers and channels"),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.contact_name = self.contact_name.strip()
        self.contact_email = self.contact_email.strip().lower()
        self.contact_phone = self.contact_phone.strip()
        self.account_number = self.account_number.strip()
        self.api_base_url = self.api_base_url.strip()
        self.tracking_base_url = self.tracking_base_url.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Provider code cannot be blank."
        if not self.name:
            errors["name"] = "Provider name cannot be blank."
        if self.integration_mode == self.IntegrationMode.ONLINE and not self.supports_online_booking:
            errors["supports_online_booking"] = "Online providers must support online booking."
        if self.integration_mode == self.IntegrationMode.OFFLINE and not self.supports_offline_booking:
            errors["supports_offline_booking"] = "Offline providers must support offline booking."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization} / {self.code}"


class LogisticsGroup(OrganizationScopedModel):
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_logistics_group_code_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.description = self.description.strip()
        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Logistics group code cannot be blank."
        if not self.name:
            errors["name"] = "Logistics group name cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization} / {self.code}"


class LogisticsProviderChannel(OrganizationScopedModel):
    class ChannelMode(models.TextChoices):
        ONLINE = "ONLINE", "Online"
        OFFLINE = "OFFLINE", "Offline"

    class TransportMode(models.TextChoices):
        EXPRESS = "EXPRESS", "Express"
        AIR = "AIR", "Air"
        GROUND = "GROUND", "Ground"
        SEA = "SEA", "Sea"
        LOCAL = "LOCAL", "Local"

    provider = models.ForeignKey(
        LogisticsProvider,
        on_delete=models.CASCADE,
        related_name="channels",
    )
    logistics_group = models.ForeignKey(
        LogisticsGroup,
        on_delete=models.SET_NULL,
        related_name="provider_channels",
        null=True,
        blank=True,
    )
    code = models.CharField(max_length=50)
    name = models.CharField(max_length=255)
    channel_mode = models.CharField(max_length=20, choices=ChannelMode.choices, default=ChannelMode.ONLINE)
    transport_mode = models.CharField(max_length=20, choices=TransportMode.choices, default=TransportMode.EXPRESS)
    service_level = models.CharField(max_length=100, blank=True, default="")
    billing_code = models.CharField(max_length=100, blank=True, default="")
    supports_waybill = models.BooleanField(default=True)
    supports_tracking = models.BooleanField(default=True)
    supports_scanform = models.BooleanField(default=False)
    supports_manifest = models.BooleanField(default=False)
    supports_relabel = models.BooleanField(default=False)
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "provider_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "provider", "code"),
                name="unique_logistics_provider_channel_code_per_provider",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.code = self.code.strip().upper()
        self.name = self.name.strip()
        self.service_level = self.service_level.strip()
        self.billing_code = self.billing_code.strip().upper()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.code:
            errors["code"] = "Provider channel code cannot be blank."
        if not self.name:
            errors["name"] = "Provider channel name cannot be blank."
        if self.provider.organization_id != self.organization_id:
            errors["provider"] = "Provider channel provider must belong to the same organization."
        if self.logistics_group_id and self.logistics_group.organization_id != self.organization_id:
            errors["logistics_group"] = "Logistics group must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.provider} / {self.code}"


class CustomerLogisticsChannel(OrganizationScopedModel):
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="logistics_channels",
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.CASCADE,
        related_name="customer_channels",
    )
    client_channel_name = models.CharField(max_length=255, blank=True, default="")
    external_account_number = models.CharField(max_length=100, blank=True, default="")
    priority = models.PositiveSmallIntegerField(default=50, validators=[MinValueValidator(1), MaxValueValidator(100)])
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "customer_account_id", "-priority", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "customer_account", "provider_channel"),
                name="unique_customer_logistics_channel_per_channel",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.client_channel_name = self.client_channel_name.strip()
        self.external_account_number = self.external_account_number.strip().upper()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class LogisticsRule(OrganizationScopedModel):
    class RuleScope(models.TextChoices):
        GENERAL = "GENERAL", "General"
        ONLINE = "ONLINE", "Online"
        OFFLINE = "OFFLINE", "Offline"

    logistics_group = models.ForeignKey(
        LogisticsGroup,
        on_delete=models.SET_NULL,
        related_name="logistics_rules",
        null=True,
        blank=True,
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="logistics_rules",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="logistics_rules",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    rule_scope = models.CharField(max_length=20, choices=RuleScope.choices, default=RuleScope.GENERAL)
    destination_country = models.CharField(max_length=2, blank=True, default="")
    destination_state = models.CharField(max_length=100, blank=True, default="")
    shipping_method = models.CharField(max_length=100, blank=True, default="")
    min_weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO_DECIMAL)
    max_weight_kg = models.DecimalField(max_digits=10, decimal_places=2, default=ZERO_DECIMAL)
    min_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    max_order_value = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    priority = models.PositiveSmallIntegerField(default=50, validators=[MinValueValidator(1), MaxValueValidator(100)])
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-priority", "name", "id")
        permissions = [
            ("manage_logistics_rules", "Can manage logistics rules"),
        ]

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.destination_country = self.destination_country.strip().upper()
        self.destination_state = self.destination_state.strip()
        self.shipping_method = self.shipping_method.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.name:
            errors["name"] = "Logistics rule name cannot be blank."
        if self.logistics_group_id and self.logistics_group.organization_id != self.organization_id:
            errors["logistics_group"] = "Logistics group must belong to the same organization."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        if self.max_weight_kg and self.max_weight_kg < self.min_weight_kg:
            errors["max_weight_kg"] = "Max weight cannot be lower than min weight."
        if self.max_order_value and self.max_order_value < self.min_order_value:
            errors["max_order_value"] = "Max order value cannot be lower than min order value."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class PartitionRule(OrganizationScopedModel):
    logistics_group = models.ForeignKey(
        LogisticsGroup,
        on_delete=models.SET_NULL,
        related_name="partition_rules",
        null=True,
        blank=True,
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="partition_rules",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    partition_key = models.CharField(max_length=100)
    partition_value = models.CharField(max_length=255)
    handling_action = models.CharField(max_length=255)
    priority = models.PositiveSmallIntegerField(default=50, validators=[MinValueValidator(1), MaxValueValidator(100)])
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-priority", "name", "id")

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.partition_key = self.partition_key.strip().upper()
        self.partition_value = self.partition_value.strip()
        self.handling_action = self.handling_action.strip()
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.name:
            errors["name"] = "Partition rule name cannot be blank."
        if not self.partition_key:
            errors["partition_key"] = "Partition key cannot be blank."
        if not self.handling_action:
            errors["handling_action"] = "Handling action cannot be blank."
        if self.logistics_group_id and self.logistics_group.organization_id != self.organization_id:
            errors["logistics_group"] = "Logistics group must belong to the same organization."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class RemoteAreaRule(OrganizationScopedModel):
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="remote_area_rules",
        null=True,
        blank=True,
    )
    country_code = models.CharField(max_length=2)
    postal_code_pattern = models.CharField(max_length=50)
    city_name = models.CharField(max_length=100, blank=True, default="")
    surcharge_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    currency = models.CharField(max_length=3, default="USD")
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "country_code", "postal_code_pattern", "id")

    def clean(self) -> None:
        super().clean()
        self.country_code = self.country_code.strip().upper()
        self.postal_code_pattern = self.postal_code_pattern.strip().upper()
        self.city_name = self.city_name.strip()
        self.currency = self.currency.strip().upper() or "USD"

        errors: dict[str, str] = {}
        if not self.country_code:
            errors["country_code"] = "Country code cannot be blank."
        if not self.postal_code_pattern:
            errors["postal_code_pattern"] = "Postal code pattern cannot be blank."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class FuelRule(OrganizationScopedModel):
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="fuel_rules",
        null=True,
        blank=True,
    )
    effective_from = models.DateField()
    effective_to = models.DateField(null=True, blank=True)
    surcharge_percent = models.DecimalField(max_digits=5, decimal_places=2, default=ZERO_DECIMAL)
    minimum_charge = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    maximum_charge = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "-effective_from", "id")

    def clean(self) -> None:
        super().clean()
        errors: dict[str, str] = {}
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if self.effective_to and self.effective_to < self.effective_from:
            errors["effective_to"] = "Effective end date cannot be earlier than the start date."
        if self.maximum_charge and self.maximum_charge < self.minimum_charge:
            errors["maximum_charge"] = "Maximum charge cannot be lower than minimum charge."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class WaybillWatermark(OrganizationScopedModel):
    class Position(models.TextChoices):
        HEADER = "HEADER", "Header"
        FOOTER = "FOOTER", "Footer"
        CENTER = "CENTER", "Center"
        DIAGONAL = "DIAGONAL", "Diagonal"

    name = models.CharField(max_length=255)
    watermark_text = models.CharField(max_length=255)
    position = models.CharField(max_length=20, choices=Position.choices, default=Position.DIAGONAL)
    opacity_percent = models.PositiveSmallIntegerField(
        default=30,
        validators=[MinValueValidator(1), MaxValueValidator(100)],
    )
    applies_to_online = models.BooleanField(default=True)
    applies_to_offline = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "name"),
                name="unique_waybill_watermark_name_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.watermark_text = self.watermark_text.strip()
        errors: dict[str, str] = {}
        if not self.name:
            errors["name"] = "Waybill watermark name cannot be blank."
        if not self.watermark_text:
            errors["watermark_text"] = "Waybill watermark text cannot be blank."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class LogisticsChargingStrategy(OrganizationScopedModel):
    class ChargingBasis(models.TextChoices):
        PER_ORDER = "PER_ORDER", "Per order"
        PER_PACKAGE = "PER_PACKAGE", "Per package"
        WEIGHT_BAND = "WEIGHT_BAND", "Weight band"
        ORDER_VALUE = "ORDER_VALUE", "Order value"

    logistics_group = models.ForeignKey(
        LogisticsGroup,
        on_delete=models.SET_NULL,
        related_name="charging_strategies",
        null=True,
        blank=True,
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="charging_strategies",
        null=True,
        blank=True,
    )
    name = models.CharField(max_length=255)
    charging_basis = models.CharField(max_length=20, choices=ChargingBasis.choices, default=ChargingBasis.PER_ORDER)
    currency = models.CharField(max_length=3, default="USD")
    base_fee = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    unit_fee = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    minimum_charge = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    includes_fuel_rule = models.BooleanField(default=True)
    includes_remote_area_fee = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "name"),
                name="unique_logistics_charging_strategy_name_per_organization",
            ),
        ]
        permissions = [
            ("manage_logistics_charging", "Can manage logistics charging and rating"),
        ]

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.name:
            errors["name"] = "Charging strategy name cannot be blank."
        if self.logistics_group_id and self.logistics_group.organization_id != self.organization_id:
            errors["logistics_group"] = "Logistics group must belong to the same organization."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class SpecialCustomerLogisticsCharging(OrganizationScopedModel):
    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.CASCADE,
        related_name="special_logistics_charging_rules",
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="special_customer_charging_rules",
        null=True,
        blank=True,
    )
    charging_strategy = models.ForeignKey(
        LogisticsChargingStrategy,
        on_delete=models.SET_NULL,
        related_name="special_customer_charging_rules",
        null=True,
        blank=True,
    )
    base_fee_override = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    unit_fee_override = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    minimum_charge_override = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    is_active = models.BooleanField(default=True)
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "customer_account_id", "id")

    def clean(self) -> None:
        super().clean()
        self.notes = self.notes.strip()
        errors: dict[str, str] = {}
        if self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if self.charging_strategy_id and self.charging_strategy.organization_id != self.organization_id:
            errors["charging_strategy"] = "Charging strategy must belong to the same organization."
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class LogisticsCharge(OrganizationScopedModel):
    class ChargeStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        PENDING_REVIEW = "PENDING_REVIEW", "Pending review"
        APPROVED = "APPROVED", "Approved"
        INVOICED = "INVOICED", "Invoiced"

    customer_account = models.ForeignKey(
        CustomerAccount,
        on_delete=models.SET_NULL,
        related_name="logistics_charges",
        null=True,
        blank=True,
    )
    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="logistics_charges",
        null=True,
        blank=True,
    )
    charging_strategy = models.ForeignKey(
        LogisticsChargingStrategy,
        on_delete=models.SET_NULL,
        related_name="logistics_charges",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="logistics_charges",
        null=True,
        blank=True,
    )
    source_reference = models.CharField(max_length=100)
    billing_reference = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=ChargeStatus.choices, default=ChargeStatus.DRAFT)
    currency = models.CharField(max_length=3, default="USD")
    base_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    fuel_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    remote_area_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    surcharge_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    charged_at = models.DateTimeField()
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-charged_at", "id")

    def clean(self) -> None:
        super().clean()
        self.source_reference = self.source_reference.strip().upper()
        self.billing_reference = self.billing_reference.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.source_reference:
            errors["source_reference"] = "Source reference cannot be blank."
        if self.customer_account_id and self.customer_account.organization_id != self.organization_id:
            errors["customer_account"] = "Customer account must belong to the same organization."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if self.charging_strategy_id and self.charging_strategy.organization_id != self.organization_id:
            errors["charging_strategy"] = "Charging strategy must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        self.total_amount = self.base_amount + self.fuel_amount + self.remote_area_amount + self.surcharge_amount
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)


class LogisticsCost(OrganizationScopedModel):
    class CostStatus(models.TextChoices):
        DRAFT = "DRAFT", "Draft"
        POSTED = "POSTED", "Posted"
        RECONCILED = "RECONCILED", "Reconciled"

    provider_channel = models.ForeignKey(
        LogisticsProviderChannel,
        on_delete=models.SET_NULL,
        related_name="logistics_costs",
        null=True,
        blank=True,
    )
    warehouse = models.ForeignKey(
        Warehouse,
        on_delete=models.SET_NULL,
        related_name="logistics_costs",
        null=True,
        blank=True,
    )
    source_reference = models.CharField(max_length=100)
    cost_reference = models.CharField(max_length=100, blank=True, default="")
    status = models.CharField(max_length=20, choices=CostStatus.choices, default=CostStatus.DRAFT)
    currency = models.CharField(max_length=3, default="USD")
    linehaul_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    fuel_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    remote_area_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    other_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=ZERO_DECIMAL)
    incurred_at = models.DateTimeField()
    notes = models.TextField(blank=True, default="")

    class Meta:
        ordering = ("organization_id", "-incurred_at", "id")
        permissions = [
            ("manage_logistics_costs", "Can manage logistics costs"),
        ]

    def clean(self) -> None:
        super().clean()
        self.source_reference = self.source_reference.strip().upper()
        self.cost_reference = self.cost_reference.strip().upper()
        self.currency = self.currency.strip().upper() or "USD"
        self.notes = self.notes.strip()

        errors: dict[str, str] = {}
        if not self.source_reference:
            errors["source_reference"] = "Source reference cannot be blank."
        if self.provider_channel_id and self.provider_channel.organization_id != self.organization_id:
            errors["provider_channel"] = "Provider channel must belong to the same organization."
        if self.warehouse_id and self.warehouse.organization_id != self.organization_id:
            errors["warehouse"] = "Warehouse must belong to the same organization."
        self.total_amount = self.linehaul_amount + self.fuel_amount + self.remote_area_amount + self.other_amount
        if errors:
            raise ValidationError(errors)

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)
