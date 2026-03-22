from django.contrib import admin

from .models import InboundImportBatch, InboundSigningRecord, PurchaseOrder, PurchaseOrderLine, PutawayTask, Receipt, ReceiptLine


class PurchaseOrderLineInline(admin.TabularInline):
    model = PurchaseOrderLine
    extra = 0
    readonly_fields = ("received_qty", "status", "create_time", "update_time")


@admin.register(PurchaseOrder)
class PurchaseOrderAdmin(admin.ModelAdmin):
    list_display = ("po_number", "order_type", "warehouse", "supplier", "status", "openid", "create_time")
    list_filter = ("order_type", "status", "warehouse", "supplier")
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


@admin.register(InboundSigningRecord)
class InboundSigningRecordAdmin(admin.ModelAdmin):
    list_display = ("signing_number", "purchase_order", "asn", "warehouse", "carrier_name", "signed_by", "signed_at")
    list_filter = ("purchase_order__order_type", "warehouse")
    search_fields = ("signing_number", "purchase_order__po_number", "asn__asn_number", "carrier_name", "vehicle_plate")


@admin.register(InboundImportBatch)
class InboundImportBatchAdmin(admin.ModelAdmin):
    list_display = ("batch_number", "file_name", "status", "success_rows", "failed_rows", "imported_by", "imported_at")
    list_filter = ("status", "imported_at")
    search_fields = ("batch_number", "file_name", "imported_by", "summary")
