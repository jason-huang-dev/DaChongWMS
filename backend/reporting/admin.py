from django.contrib import admin

from .models import (
    BillingChargeEvent,
    BillingRateContract,
    FinanceExport,
    Invoice,
    InvoiceFinanceApproval,
    InvoiceLine,
    OperationalReportExport,
    StorageAccrualRun,
    WarehouseKpiSnapshot,
)


@admin.register(WarehouseKpiSnapshot)
class WarehouseKpiSnapshotAdmin(admin.ModelAdmin):
    list_display = ("id", "warehouse", "snapshot_date", "on_hand_qty", "available_qty", "generated_by")
    list_filter = ("snapshot_date", "warehouse")
    search_fields = ("warehouse__warehouse_name", "generated_by")


@admin.register(OperationalReportExport)
class OperationalReportExportAdmin(admin.ModelAdmin):
    list_display = ("id", "report_type", "warehouse", "row_count", "generated_by", "generated_at")
    list_filter = ("report_type", "status")
    search_fields = ("file_name", "generated_by")


@admin.register(BillingChargeEvent)
class BillingChargeEventAdmin(admin.ModelAdmin):
    list_display = ("id", "charge_type", "warehouse", "customer", "event_date", "amount", "status")
    list_filter = ("charge_type", "status", "currency")
    search_fields = ("reference_code", "source_module", "notes")


@admin.register(BillingRateContract)
class BillingRateContractAdmin(admin.ModelAdmin):
    list_display = ("id", "contract_name", "warehouse", "customer", "charge_type", "unit_rate", "effective_from", "is_active")
    list_filter = ("charge_type", "is_active", "currency")
    search_fields = ("contract_name", "notes")


@admin.register(StorageAccrualRun)
class StorageAccrualRunAdmin(admin.ModelAdmin):
    list_display = ("id", "warehouse", "customer", "accrual_date", "total_on_hand_qty", "status", "generated_by")
    list_filter = ("status", "accrual_date", "warehouse")
    search_fields = ("customer__customer_name", "generated_by", "notes")


class InvoiceLineInline(admin.TabularInline):
    model = InvoiceLine
    extra = 0
    readonly_fields = ("charge_event", "charge_type", "event_date", "quantity", "uom", "unit_rate", "amount", "description", "reference_code")


class InvoiceFinanceApprovalInline(admin.StackedInline):
    model = InvoiceFinanceApproval
    extra = 0
    readonly_fields = ("status", "submitted_at", "submitted_by", "reviewed_at", "reviewed_by", "notes")


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_number", "warehouse", "customer", "period_start", "period_end", "status", "total_amount")
    list_filter = ("status", "currency")
    search_fields = ("invoice_number", "notes")
    inlines = [InvoiceLineInline, InvoiceFinanceApprovalInline]


@admin.register(FinanceExport)
class FinanceExportAdmin(admin.ModelAdmin):
    list_display = ("id", "file_name", "warehouse", "customer", "period_start", "period_end", "row_count", "generated_by")
    list_filter = ("status", "warehouse")
    search_fields = ("file_name", "generated_by")
