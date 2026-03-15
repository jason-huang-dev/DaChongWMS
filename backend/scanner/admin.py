from django.contrib import admin

from .models import (
    BarcodeAlias,
    GoodsScanRule,
    HandheldDeviceSession,
    HandheldTelemetrySample,
    LicensePlate,
    ListModel,
    OfflineReplayBatch,
    OfflineReplayEvent,
)


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('mode', 'openid', 'is_delete')
    search_fields = ('mode', 'openid')
    list_filter = ('is_delete',)


@admin.register(BarcodeAlias)
class BarcodeAliasAdmin(admin.ModelAdmin):
    list_display = ("target_type", "alias_code", "goods", "location", "openid", "is_delete")
    search_fields = ("alias_code", "openid")
    list_filter = ("target_type", "is_delete")


@admin.register(GoodsScanRule)
class GoodsScanRuleAdmin(admin.ModelAdmin):
    list_display = ("goods", "requires_lot", "requires_serial", "openid")
    search_fields = ("goods__goods_code", "openid")
    list_filter = ("requires_lot", "requires_serial")


@admin.register(LicensePlate)
class LicensePlateAdmin(admin.ModelAdmin):
    list_display = ("lpn_code", "warehouse", "goods", "current_location", "quantity", "status", "openid")
    search_fields = ("lpn_code", "reference_code", "openid")
    list_filter = ("status", "warehouse")


class OfflineReplayEventInline(admin.TabularInline):
    model = OfflineReplayEvent
    extra = 0
    readonly_fields = (
        "sequence_number",
        "event_type",
        "status",
        "processed_at",
        "result_record_type",
        "result_record_id",
        "conflict_rule",
        "conflict_type",
        "conflict_key",
        "result_summary",
        "error_message",
    )


@admin.register(HandheldDeviceSession)
class HandheldDeviceSessionAdmin(admin.ModelAdmin):
    list_display = (
        "device_id",
        "operator",
        "platform",
        "app_version",
        "status",
        "last_seen_at",
        "total_scan_count",
        "total_sync_count",
        "total_conflict_count",
    )
    search_fields = ("device_id", "device_label", "operator__staff_name")
    list_filter = ("status", "platform")


@admin.register(OfflineReplayBatch)
class OfflineReplayBatchAdmin(admin.ModelAdmin):
    list_display = (
        "client_batch_id",
        "session",
        "operator",
        "status",
        "event_count",
        "replayed_count",
        "conflict_count",
        "failed_count",
    )
    search_fields = ("client_batch_id", "session__device_id", "operator__staff_name")
    list_filter = ("status",)
    inlines = [OfflineReplayEventInline]


@admin.register(HandheldTelemetrySample)
class HandheldTelemetrySampleAdmin(admin.ModelAdmin):
    list_display = ("session", "operator", "recorded_at", "scan_count", "queued_event_count", "network_type", "battery_level")
    search_fields = ("session__device_id", "operator__staff_name", "network_type")
    list_filter = ("network_type",)
