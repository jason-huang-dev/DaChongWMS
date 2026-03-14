from django.contrib import admin

from .models import PickTask, SalesOrder, SalesOrderLine, Shipment, ShipmentLine


class SalesOrderLineInline(admin.TabularInline):
    model = SalesOrderLine
    extra = 0
    readonly_fields = ("allocated_qty", "picked_qty", "shipped_qty", "status", "create_time", "update_time")


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("order_number", "warehouse", "customer", "status", "staging_location", "create_time")
    list_filter = ("status", "warehouse", "customer")
    search_fields = ("order_number", "reference_code", "customer__customer_name")
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
