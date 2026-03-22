from django.contrib import admin

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


@admin.register(LogisticsProvider)
class LogisticsProviderAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "provider_type", "integration_mode", "is_active")
    search_fields = ("code", "name", "account_number", "organization__name")
    list_filter = ("provider_type", "integration_mode", "is_active")


@admin.register(LogisticsProviderChannel)
class LogisticsProviderChannelAdmin(admin.ModelAdmin):
    list_display = ("organization", "provider", "code", "name", "channel_mode", "transport_mode", "is_active")
    search_fields = ("code", "name", "service_level", "provider__name", "organization__name")
    list_filter = ("channel_mode", "transport_mode", "is_active", "supports_waybill", "supports_tracking")


@admin.register(CustomerLogisticsChannel)
class CustomerLogisticsChannelAdmin(admin.ModelAdmin):
    list_display = ("organization", "customer_account", "provider_channel", "priority", "is_default", "is_active")
    search_fields = ("customer_account__name", "customer_account__code", "provider_channel__name", "client_channel_name")
    list_filter = ("is_default", "is_active")


@admin.register(LogisticsGroup)
class LogisticsGroupAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "is_active")
    search_fields = ("code", "name", "organization__name")
    list_filter = ("is_active",)


@admin.register(LogisticsRule)
class LogisticsRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "name", "rule_scope", "provider_channel", "warehouse", "priority", "is_active")
    search_fields = ("name", "destination_country", "destination_state", "shipping_method")
    list_filter = ("rule_scope", "is_active")


@admin.register(PartitionRule)
class PartitionRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "name", "partition_key", "partition_value", "priority", "is_active")
    search_fields = ("name", "partition_key", "partition_value", "handling_action")
    list_filter = ("is_active",)


@admin.register(RemoteAreaRule)
class RemoteAreaRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "provider_channel", "country_code", "postal_code_pattern", "surcharge_amount", "currency", "is_active")
    search_fields = ("country_code", "postal_code_pattern", "city_name")
    list_filter = ("is_active", "currency")


@admin.register(FuelRule)
class FuelRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "provider_channel", "effective_from", "effective_to", "surcharge_percent", "is_active")
    list_filter = ("is_active",)


@admin.register(WaybillWatermark)
class WaybillWatermarkAdmin(admin.ModelAdmin):
    list_display = ("organization", "name", "position", "opacity_percent", "applies_to_online", "applies_to_offline", "is_active")
    search_fields = ("name", "watermark_text")
    list_filter = ("position", "is_active", "applies_to_online", "applies_to_offline")


@admin.register(LogisticsChargingStrategy)
class LogisticsChargingStrategyAdmin(admin.ModelAdmin):
    list_display = ("organization", "name", "charging_basis", "provider_channel", "currency", "is_active")
    search_fields = ("name", "provider_channel__name")
    list_filter = ("charging_basis", "currency", "is_active")


@admin.register(SpecialCustomerLogisticsCharging)
class SpecialCustomerLogisticsChargingAdmin(admin.ModelAdmin):
    list_display = ("organization", "customer_account", "provider_channel", "charging_strategy", "is_active")
    search_fields = ("customer_account__name", "customer_account__code")
    list_filter = ("is_active",)


@admin.register(LogisticsCharge)
class LogisticsChargeAdmin(admin.ModelAdmin):
    list_display = ("organization", "source_reference", "customer_account", "provider_channel", "status", "total_amount", "currency", "charged_at")
    search_fields = ("source_reference", "billing_reference")
    list_filter = ("status", "currency")


@admin.register(LogisticsCost)
class LogisticsCostAdmin(admin.ModelAdmin):
    list_display = ("organization", "source_reference", "provider_channel", "status", "total_amount", "currency", "incurred_at")
    search_fields = ("source_reference", "cost_reference")
    list_filter = ("status", "currency")

