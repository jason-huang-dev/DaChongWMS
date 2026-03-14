from django.contrib import admin

from .models import PurchaseOrder, PurchaseOrderLine, PutawayTask, Receipt, ReceiptLine


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0
    readonly_fields = ("received_qty", "status", "create_time", "update_time")


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "warehouse", "supplier", "status", "openid", "create_time")
    list_filter = ("status", "warehouse", "supplier")
    search_fields = ("po_number", "reference_code", "supplier__supplier_name")
    inlines = [PurchaseOrderLineInline]


class ReceiptLineInline(admin.TabularInline):
    model = ReceiptLine
    extra = 0
    readonly_fields = ("inventory_movement", "create_time", "update_time")


@admin.register(Receipt)
class ReceiptAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "purchase_order", "warehouse", "receipt_location", "received_by", "received_at")
    list_filter = ("warehouse", "receipt_location")
    search_fields = ("receipt_number", "purchase_order__po_number", "reference_code")
    inlines = [ReceiptLineInline]


@admin.register(PutawayTask)
class PutawayTaskAdmin(admin.ModelAdmin):
    list_display = ("task_number", "goods", "from_location", "to_location", "status", "assigned_to")
    list_filter = ("status", "warehouse")
    search_fields = ("task_number", "goods__goods_code", "from_location__location_code", "to_location__location_code")
