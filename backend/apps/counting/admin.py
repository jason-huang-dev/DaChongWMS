from django.contrib import admin

from apps.counting.models import CountApproval, CycleCount, CycleCountLine


@admin.register(CycleCount)
class CycleCountAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "count_number", "status", "is_blind_count", "scheduled_date")
    search_fields = ("count_number", "warehouse__name", "organization__name")
    list_filter = ("status", "is_blind_count", "warehouse")


@admin.register(CycleCountLine)
class CycleCountLineAdmin(admin.ModelAdmin):
    list_display = ("organization", "cycle_count", "line_number", "product", "status", "system_qty", "counted_qty")
    search_fields = ("cycle_count__count_number", "product__sku", "location__code", "organization__name")
    list_filter = ("status", "stock_status")


@admin.register(CountApproval)
class CountApprovalAdmin(admin.ModelAdmin):
    list_display = ("organization", "cycle_count_line", "status", "requested_by", "approved_by", "rejected_by")
    search_fields = ("cycle_count_line__cycle_count__count_number", "requested_by", "approved_by", "rejected_by")
    list_filter = ("status",)

