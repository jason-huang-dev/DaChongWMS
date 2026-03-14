from django.contrib import admin

from .models import ReplenishmentRule, ReplenishmentTask, TransferLine, TransferOrder


@admin.register(TransferOrder)
class TransferOrderAdmin(admin.ModelAdmin):
    list_display = ("transfer_number", "warehouse", "status", "requested_date", "openid")
    search_fields = ("transfer_number", "reference_code", "notes")
    list_filter = ("status", "warehouse")


@admin.register(TransferLine)
class TransferLineAdmin(admin.ModelAdmin):
    list_display = ("transfer_order", "line_number", "goods", "from_location", "to_location", "requested_qty", "status")
    search_fields = ("transfer_order__transfer_number", "goods__goods_code")
    list_filter = ("status", "stock_status", "from_location", "to_location")


@admin.register(ReplenishmentRule)
class ReplenishmentRuleAdmin(admin.ModelAdmin):
    list_display = ("goods", "source_location", "target_location", "minimum_qty", "target_qty", "priority", "is_active")
    search_fields = ("goods__goods_code", "source_location__location_code", "target_location__location_code")
    list_filter = ("warehouse", "stock_status", "is_active")


@admin.register(ReplenishmentTask)
class ReplenishmentTaskAdmin(admin.ModelAdmin):
    list_display = ("task_number", "goods", "from_location", "to_location", "quantity", "status", "assigned_to")
    search_fields = ("task_number", "goods__goods_code")
    list_filter = ("warehouse", "status", "stock_status")
