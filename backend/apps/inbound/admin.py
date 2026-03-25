from django.contrib import admin

from apps.inbound.models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PutawayTask,
    Receipt,
    ReceiptLine,
)


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "po_number", "order_type", "customer_code", "status")
    search_fields = ("po_number", "customer_code", "customer_name", "supplier_code", "supplier_name")
    list_filter = ("status", "order_type", "warehouse")


@admin.register(PurchaseOrderLine)
class PurchaseOrderLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "purchase_order", "line_number", "product", "ordered_qty", "received_qty", "status")
    search_fields = ("purchase_order__po_number", "product__sku")
    list_filter = ("status", "stock_status")


@admin.register(AdvanceShipmentNotice)
class AdvanceShipmentNoticeAdmin(admin.ModelAdmin):
    list_display = ("organization", "asn_number", "purchase_order", "status", "expected_arrival_date")
    search_fields = ("asn_number", "purchase_order__po_number", "organization__name")
    list_filter = ("status", "warehouse")


@admin.register(AdvanceShipmentNoticeLine)
class AdvanceShipmentNoticeLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "asn", "line_number", "product", "expected_qty", "received_qty")
    search_fields = ("asn__asn_number", "product__sku")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("organization", "receipt_number", "purchase_order", "warehouse", "received_by", "received_at")
    search_fields = ("receipt_number", "purchase_order__po_number", "received_by")
    list_filter = ("status", "warehouse")


@admin.register(ReceiptLine)
class ReceiptLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "receipt", "purchase_order_line", "product", "received_qty", "stock_status")
    search_fields = ("receipt__receipt_number", "purchase_order_line__purchase_order__po_number", "product__sku")


@admin.register(PutawayTask)
class PutawayTaskAdmin(admin.ModelAdmin):
    list_display = ("organization", "task_number", "product", "from_location", "to_location", "quantity", "status")
    search_fields = ("task_number", "product__sku", "receipt_line__receipt__receipt_number")
    list_filter = ("status", "warehouse")

