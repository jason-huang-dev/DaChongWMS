from django.contrib import admin

from .models import CountApproval, CycleCount, CycleCountLine


class CycleCountLineInline(admin.TabularInline):
    model = CycleCountLine
    extra = 0
    readonly_fields = ("system_qty", "counted_qty", "variance_qty", "status", "counted_by", "counted_at")


@admin.register(CycleCount)
class CycleCountAdmin(admin.ModelAdmin):
    list_display = ("count_number", "warehouse", "status", "scheduled_date", "submitted_by", "completed_at")
    list_filter = ("status", "warehouse")
    search_fields = ("count_number", "notes", "submitted_by")
    inlines = [CycleCountLineInline]


@admin.register(CycleCountLine)
class CycleCountLineAdmin(admin.ModelAdmin):
    list_display = ("cycle_count", "line_number", "goods", "location", "system_qty", "counted_qty", "variance_qty", "status")
    list_filter = ("status", "stock_status")
    search_fields = ("cycle_count__count_number", "goods__goods_code", "location__location_code", "lot_number", "serial_number")


@admin.register(CountApproval)
class CountApprovalAdmin(admin.ModelAdmin):
    list_display = ("cycle_count_line", "status", "requested_by", "approved_by", "rejected_by", "requested_at")
    list_filter = ("status",)
    search_fields = ("cycle_count_line__cycle_count__count_number", "requested_by", "approved_by", "rejected_by")
