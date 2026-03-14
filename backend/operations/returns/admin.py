from django.contrib import admin

from .models import ReturnDisposition, ReturnLine, ReturnOrder, ReturnReceipt


@admin.register(ReturnOrder)
class ReturnOrderAdmin(admin.ModelAdmin):
    list_display = ("return_number", "warehouse", "customer", "status", "requested_date", "openid")
    search_fields = ("return_number", "reference_code", "notes")
    list_filter = ("status", "warehouse", "customer")


@admin.register(ReturnLine)
class ReturnLineAdmin(admin.ModelAdmin):
    list_display = ("return_order", "line_number", "goods", "expected_qty", "received_qty", "disposed_qty", "status")
    search_fields = ("return_order__return_number", "goods__goods_code", "return_reason")
    list_filter = ("status",)


@admin.register(ReturnReceipt)
class ReturnReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "return_line", "warehouse", "receipt_location", "received_qty", "stock_status", "received_by")
    search_fields = ("receipt_number", "return_line__return_order__return_number", "return_line__goods__goods_code")
    list_filter = ("warehouse", "stock_status")


@admin.register(ReturnDisposition)
class ReturnDispositionAdmin(admin.ModelAdmin):
    list_display = ("disposition_number", "return_receipt", "disposition_type", "quantity", "to_location", "completed_by")
    search_fields = ("disposition_number", "return_receipt__receipt_number", "return_receipt__return_line__goods__goods_code")
    list_filter = ("warehouse", "disposition_type")
