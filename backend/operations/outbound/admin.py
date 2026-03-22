from django.contrib import admin

from .models import (
    LogisticsTrackingEvent,
    OutboundWave,
    OutboundWaveOrder,
    PackageExecutionRecord,
    PickTask,
    SalesOrder,
    SalesOrderLine,
    Shipment,
    ShipmentDocumentRecord,
    ShipmentLine,
)


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0
    readonly_fields = ("allocated_qty", "picked_qty", "shipped_qty", "status", "create_time", "update_time")


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = (
        "order_number",
        "order_type",
        "warehouse",
        "customer",
        "status",
        "fulfillment_stage",
        "exception_state",
        "tracking_number",
        "shipping_method",
        "staging_location",
        "create_time",
    )
    list_filter = ("order_type", "status", "fulfillment_stage", "exception_state", "warehouse", "customer")
    search_fields = (
        "order_number",
        "reference_code",
        "tracking_number",
        "waybill_number",
        "receiver_name",
        "deliverer_name",
        "customer__customer_name",
    )
    inlines = [SalesOrderLineInline]


@admin.register(PickTask)
class PickTaskAdmin(admin.ModelAdmin):
    list_display = ("task_number", "goods", "from_location", "to_location", "status", "assigned_to")
    list_filter = ("status", "warehouse")
    search_fields = ("task_number", "goods__goods_code", "from_location__location_code", "to_location__location_code")


class ShipmentLineInline(admin.TabularInline):
    model = ShipmentLine
    extra = 0
    readonly_fields = ("inventory_movement", "create_time", "update_time")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("shipment_number", "sales_order", "warehouse", "staging_location", "shipped_by", "shipped_at")
    list_filter = ("warehouse", "staging_location")
    search_fields = ("shipment_number", "sales_order__order_number", "reference_code")
    inlines = [ShipmentLineInline]


class OutboundWaveOrderInline(admin.TabularInline):
    model = OutboundWaveOrder
    extra = 0
    readonly_fields = ("sort_sequence", "create_time", "update_time")


@admin.register(OutboundWave)
class OutboundWaveAdmin(admin.ModelAdmin):
    list_display = ("wave_number", "order_type", "warehouse", "status", "generated_by", "generated_at")
    list_filter = ("order_type", "status", "warehouse")
    search_fields = ("wave_number", "notes", "generated_by")
    inlines = [OutboundWaveOrderInline]


@admin.register(PackageExecutionRecord)
class PackageExecutionRecordAdmin(admin.ModelAdmin):
    list_display = ("record_number", "warehouse", "sales_order", "step_type", "execution_status", "package_number", "executed_at")
    list_filter = ("sales_order__order_type", "step_type", "execution_status", "warehouse")
    search_fields = ("record_number", "package_number", "scan_code", "sales_order__order_number")


@admin.register(ShipmentDocumentRecord)
class ShipmentDocumentRecordAdmin(admin.ModelAdmin):
    list_display = ("document_number", "document_type", "warehouse", "sales_order", "shipment", "generated_at")
    list_filter = ("sales_order__order_type", "document_type", "warehouse")
    search_fields = ("document_number", "reference_code", "file_name", "sales_order__order_number")


@admin.register(LogisticsTrackingEvent)
class LogisticsTrackingEventAdmin(admin.ModelAdmin):
    list_display = ("event_number", "warehouse", "sales_order", "tracking_number", "event_status", "occurred_at")
    list_filter = ("sales_order__order_type", "event_status", "warehouse")
    search_fields = ("event_number", "tracking_number", "event_code", "sales_order__order_number")
