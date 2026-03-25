from django.contrib import admin

from apps.outbound.models import PickTask, SalesOrder, SalesOrderLine, Shipment, ShipmentLine


@admin.register(SalesOrder)
class SalesOrderAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "order_number", "order_type", "customer_code", "status", "fulfillment_stage")
    search_fields = ("order_number", "customer_code", "customer_name", "tracking_number", "organization__name")
    list_filter = ("order_type", "status", "fulfillment_stage", "warehouse")


@admin.register(SalesOrderLine)
class SalesOrderLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "sales_order", "line_number", "product", "ordered_qty", "status")
    search_fields = ("sales_order__order_number", "product__sku", "organization__name")
    list_filter = ("status", "stock_status")


@admin.register(PickTask)
class PickTaskAdmin(admin.ModelAdmin):
    list_display = ("organization", "task_number", "sales_order_line", "from_location", "to_location", "quantity", "status")
    search_fields = ("task_number", "sales_order_line__sales_order__order_number", "sales_order_line__product__sku")
    list_filter = ("status", "warehouse")


@admin.register(Shipment)
class ShipmentAdmin(admin.ModelAdmin):
    list_display = ("organization", "shipment_number", "sales_order", "tracking_number", "status", "shipped_at")
    search_fields = ("shipment_number", "sales_order__order_number", "tracking_number", "organization__name")
    list_filter = ("status", "warehouse")


@admin.register(ShipmentLine)
class ShipmentLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "shipment", "sales_order_line", "quantity")
    search_fields = ("shipment__shipment_number", "sales_order_line__sales_order__order_number", "sales_order_line__product__sku")

