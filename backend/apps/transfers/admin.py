from django.contrib import admin

from apps.transfers.models import ReplenishmentRule, ReplenishmentTask, TransferLine, TransferOrder


@admin.register(TransferOrder)
class TransferOrderAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "transfer_number", "status", "requested_date")
    search_fields = ("transfer_number", "reference_code", "organization__name", "warehouse__name")
    list_filter = ("status", "warehouse")


@admin.register(TransferLine)
class TransferLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "transfer_order", "line_number", "product", "status", "requested_qty", "moved_qty")
    search_fields = ("transfer_order__transfer_number", "product__sku", "organization__name")
    list_filter = ("status", "stock_status")


@admin.register(ReplenishmentRule)
class ReplenishmentRuleAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "product", "source_location", "target_location", "priority", "is_active")
    search_fields = ("product__sku", "organization__name", "warehouse__name")
    list_filter = ("is_active", "stock_status", "warehouse")


@admin.register(ReplenishmentTask)
class ReplenishmentTaskAdmin(admin.ModelAdmin):
    list_display = ("organization", "task_number", "product", "status", "priority", "generated_at")
    search_fields = ("task_number", "product__sku", "organization__name")
    list_filter = ("status", "stock_status")

