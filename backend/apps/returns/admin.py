from django.contrib import admin

from apps.returns.models import ReturnDisposition, ReturnLine, ReturnOrder, ReturnReceipt


@admin.register(ReturnOrder)
class ReturnOrderAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "return_number", "order_type", "customer_code", "status")
    search_fields = ("return_number", "customer_code", "customer_name", "reference_code")
    list_filter = ("status", "order_type", "warehouse")


@admin.register(ReturnLine)
class ReturnLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "return_order", "line_number", "product", "expected_qty", "received_qty", "disposed_qty", "status")
    search_fields = ("return_order__return_number", "product__sku")
    list_filter = ("status",)


@admin.register(ReturnReceipt)
class ReturnReceiptAdmin(admin.ModelAdmin):
    list_display = ("organization", "receipt_number", "return_line", "warehouse", "received_qty", "stock_status", "received_by")
    search_fields = ("receipt_number", "return_line__return_order__return_number", "return_line__product__sku", "received_by")
    list_filter = ("warehouse", "stock_status")


@admin.register(ReturnDisposition)
class ReturnDispositionAdmin(admin.ModelAdmin):
    list_display = ("organization", "disposition_number", "return_receipt", "disposition_type", "quantity", "completed_by")
    search_fields = ("disposition_number", "return_receipt__receipt_number", "return_receipt__return_line__return_order__return_number")
    list_filter = ("disposition_type", "warehouse")

