from django.contrib import admin

from apps.reporting.models import OperationalReportExport, WarehouseKpiSnapshot


@admin.register(WarehouseKpiSnapshot)
class WarehouseKpiSnapshotAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "snapshot_date", "generated_by", "generated_at")
    search_fields = ("warehouse__code", "warehouse__name", "generated_by")
    list_filter = ("warehouse", "snapshot_date")


@admin.register(OperationalReportExport)
class OperationalReportExportAdmin(admin.ModelAdmin):
    list_display = ("organization", "report_type", "warehouse", "row_count", "generated_by", "generated_at")
    search_fields = ("file_name", "generated_by")
    list_filter = ("report_type", "warehouse", "status")

