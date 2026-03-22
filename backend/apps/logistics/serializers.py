from __future__ import annotations

from rest_framework import serializers

from .models import (
    CustomerLogisticsChannel,
    FuelRule,
    LogisticsCharge,
    LogisticsChargingStrategy,
    LogisticsCost,
    LogisticsGroup,
    LogisticsProvider,
    LogisticsProviderChannel,
    LogisticsRule,
    PartitionRule,
    RemoteAreaRule,
    SpecialCustomerLogisticsCharging,
    WaybillWatermark,
)


class LogisticsProviderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = LogisticsProvider
        fields = (
            "id",
            "organization_id",
            "code",
            "name",
            "provider_type",
            "integration_mode",
            "contact_name",
            "contact_email",
            "contact_phone",
            "account_number",
            "api_base_url",
            "tracking_base_url",
            "supports_online_booking",
            "supports_offline_booking",
            "notes",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "created_at", "updated_at")


class LogisticsGroupSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = LogisticsGroup
        fields = ("id", "organization_id", "code", "name", "description", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "organization_id", "created_at", "updated_at")


class LogisticsProviderChannelSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    provider_name = serializers.CharField(source="provider.name", read_only=True)
    provider_code = serializers.CharField(source="provider.code", read_only=True)
    logistics_group_name = serializers.CharField(source="logistics_group.name", read_only=True)

    class Meta:
        model = LogisticsProviderChannel
        fields = (
            "id",
            "organization_id",
            "provider",
            "provider_name",
            "provider_code",
            "logistics_group",
            "logistics_group_name",
            "code",
            "name",
            "channel_mode",
            "transport_mode",
            "service_level",
            "billing_code",
            "supports_waybill",
            "supports_tracking",
            "supports_scanform",
            "supports_manifest",
            "supports_relabel",
            "is_default",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "provider_name",
            "provider_code",
            "logistics_group_name",
            "created_at",
            "updated_at",
        )


class CustomerLogisticsChannelSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    customer_account_code = serializers.CharField(source="customer_account.code", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)
    provider_channel_code = serializers.CharField(source="provider_channel.code", read_only=True)

    class Meta:
        model = CustomerLogisticsChannel
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "customer_account_code",
            "provider_channel",
            "provider_channel_name",
            "provider_channel_code",
            "client_channel_name",
            "external_account_number",
            "priority",
            "is_default",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "customer_account_code",
            "provider_channel_name",
            "provider_channel_code",
            "created_at",
            "updated_at",
        )


class LogisticsRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    logistics_group_name = serializers.CharField(source="logistics_group.name", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = LogisticsRule
        fields = (
            "id",
            "organization_id",
            "logistics_group",
            "logistics_group_name",
            "provider_channel",
            "provider_channel_name",
            "warehouse",
            "warehouse_name",
            "name",
            "rule_scope",
            "destination_country",
            "destination_state",
            "shipping_method",
            "min_weight_kg",
            "max_weight_kg",
            "min_order_value",
            "max_order_value",
            "priority",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "logistics_group_name",
            "provider_channel_name",
            "warehouse_name",
            "created_at",
            "updated_at",
        )


class PartitionRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    logistics_group_name = serializers.CharField(source="logistics_group.name", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)

    class Meta:
        model = PartitionRule
        fields = (
            "id",
            "organization_id",
            "logistics_group",
            "logistics_group_name",
            "provider_channel",
            "provider_channel_name",
            "name",
            "partition_key",
            "partition_value",
            "handling_action",
            "priority",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "logistics_group_name",
            "provider_channel_name",
            "created_at",
            "updated_at",
        )


class RemoteAreaRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)

    class Meta:
        model = RemoteAreaRule
        fields = (
            "id",
            "organization_id",
            "provider_channel",
            "provider_channel_name",
            "country_code",
            "postal_code_pattern",
            "city_name",
            "surcharge_amount",
            "currency",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "provider_channel_name", "created_at", "updated_at")


class FuelRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)

    class Meta:
        model = FuelRule
        fields = (
            "id",
            "organization_id",
            "provider_channel",
            "provider_channel_name",
            "effective_from",
            "effective_to",
            "surcharge_percent",
            "minimum_charge",
            "maximum_charge",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "provider_channel_name", "created_at", "updated_at")


class WaybillWatermarkSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WaybillWatermark
        fields = (
            "id",
            "organization_id",
            "name",
            "watermark_text",
            "position",
            "opacity_percent",
            "applies_to_online",
            "applies_to_offline",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "organization_id", "created_at", "updated_at")


class LogisticsChargingStrategySerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    logistics_group_name = serializers.CharField(source="logistics_group.name", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)

    class Meta:
        model = LogisticsChargingStrategy
        fields = (
            "id",
            "organization_id",
            "logistics_group",
            "logistics_group_name",
            "provider_channel",
            "provider_channel_name",
            "name",
            "charging_basis",
            "currency",
            "base_fee",
            "unit_fee",
            "minimum_charge",
            "includes_fuel_rule",
            "includes_remote_area_fee",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "logistics_group_name",
            "provider_channel_name",
            "created_at",
            "updated_at",
        )


class SpecialCustomerLogisticsChargingSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)
    charging_strategy_name = serializers.CharField(source="charging_strategy.name", read_only=True)

    class Meta:
        model = SpecialCustomerLogisticsCharging
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "provider_channel",
            "provider_channel_name",
            "charging_strategy",
            "charging_strategy_name",
            "base_fee_override",
            "unit_fee_override",
            "minimum_charge_override",
            "is_active",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "provider_channel_name",
            "charging_strategy_name",
            "created_at",
            "updated_at",
        )


class LogisticsChargeSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)
    charging_strategy_name = serializers.CharField(source="charging_strategy.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = LogisticsCharge
        fields = (
            "id",
            "organization_id",
            "customer_account",
            "customer_account_name",
            "provider_channel",
            "provider_channel_name",
            "charging_strategy",
            "charging_strategy_name",
            "warehouse",
            "warehouse_name",
            "source_reference",
            "billing_reference",
            "status",
            "currency",
            "base_amount",
            "fuel_amount",
            "remote_area_amount",
            "surcharge_amount",
            "total_amount",
            "charged_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_account_name",
            "provider_channel_name",
            "charging_strategy_name",
            "warehouse_name",
            "total_amount",
            "created_at",
            "updated_at",
        )


class LogisticsCostSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    provider_channel_name = serializers.CharField(source="provider_channel.name", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)

    class Meta:
        model = LogisticsCost
        fields = (
            "id",
            "organization_id",
            "provider_channel",
            "provider_channel_name",
            "warehouse",
            "warehouse_name",
            "source_reference",
            "cost_reference",
            "status",
            "currency",
            "linehaul_amount",
            "fuel_amount",
            "remote_area_amount",
            "other_amount",
            "total_amount",
            "incurred_at",
            "notes",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "provider_channel_name",
            "warehouse_name",
            "total_amount",
            "created_at",
            "updated_at",
        )

