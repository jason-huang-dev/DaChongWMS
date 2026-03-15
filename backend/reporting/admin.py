from django.contrib import admin

from .models import (
    BillingChargeEvent,
    BillingRateContract,
    CreditNote,
    ExternalRemittanceBatch,
    ExternalRemittanceItem,
    FinanceExport,
    Invoice,
    InvoiceDispute,
    InvoiceFinanceApproval,
    InvoiceLine,
    InvoiceRemittance,
    InvoiceSettlement,
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


class InvoiceRemittanceInline(admin.TabularInline):
    model = InvoiceRemittance
    extra = 0
    readonly_fields = ("status", "remittance_reference", "remitted_at", "remitted_by", "amount", "currency", "notes")


class InvoiceSettlementInline(admin.StackedInline):
    model = InvoiceSettlement
    extra = 0
    readonly_fields = (
        "status",
        "requested_amount",
        "approved_amount",
        "remitted_amount",
        "currency",
        "due_date",
        "settlement_reference",
        "submitted_at",
        "submitted_by",
        "reviewed_at",
        "reviewed_by",
        "completed_at",
        "notes",
    )


class InvoiceDisputeInline(admin.TabularInline):
    model = InvoiceDispute
    extra = 0
    readonly_fields = (
        "invoice_line",
        "status",
        "reason_code",
        "reference_code",
        "disputed_amount",
        "approved_credit_amount",
        "opened_at",
        "opened_by",
        "resolved_at",
        "resolved_by",
    )


@admin.register(Invoice)
class InvoiceAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice_number", "warehouse", "customer", "period_start", "period_end", "status", "total_amount")
    list_filter = ("status", "currency")
    search_fields = ("invoice_number", "notes")
    inlines = [InvoiceLineInline, InvoiceFinanceApprovalInline, InvoiceSettlementInline, InvoiceDisputeInline]


@admin.register(InvoiceSettlement)
class InvoiceSettlementAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "status", "requested_amount", "approved_amount", "remitted_amount", "due_date")
    list_filter = ("status", "currency")
    search_fields = ("invoice__invoice_number", "settlement_reference", "notes")
    inlines = [InvoiceRemittanceInline]


@admin.register(InvoiceRemittance)
class InvoiceRemittanceAdmin(admin.ModelAdmin):
    list_display = ("id", "remittance_reference", "settlement", "amount", "currency", "status", "remitted_at")
    list_filter = ("status", "currency")
    search_fields = ("remittance_reference", "settlement__invoice__invoice_number", "notes")


@admin.register(InvoiceDispute)
class InvoiceDisputeAdmin(admin.ModelAdmin):
    list_display = ("id", "invoice", "invoice_line", "status", "reason_code", "disputed_amount", "approved_credit_amount")
    list_filter = ("status", "reason_code")
    search_fields = ("invoice__invoice_number", "reference_code", "notes", "resolution_notes")


@admin.register(CreditNote)
class CreditNoteAdmin(admin.ModelAdmin):
    list_display = ("id", "credit_note_number", "invoice", "dispute", "status", "amount", "currency", "issued_at")
    list_filter = ("status", "reason_code", "currency")
    search_fields = ("credit_note_number", "invoice__invoice_number", "reference_code", "notes")


class ExternalRemittanceItemInline(admin.TabularInline):
    model = ExternalRemittanceItem
    extra = 0
    readonly_fields = (
        "invoice",
        "settlement",
        "remittance",
        "external_reference",
        "matched_invoice_number",
        "matched_settlement_reference",
        "amount",
        "currency",
        "status",
        "processed_at",
        "error_message",
    )


@admin.register(ExternalRemittanceBatch)
class ExternalRemittanceBatchAdmin(admin.ModelAdmin):
    list_display = ("id", "source_system", "external_batch_id", "status", "item_count", "applied_count", "conflict_count", "failed_count")
    list_filter = ("status", "source_system")
    search_fields = ("external_batch_id", "source_system", "last_error", "notes")
    inlines = [ExternalRemittanceItemInline]


@admin.register(FinanceExport)
class FinanceExportAdmin(admin.ModelAdmin):
    list_display = ("id", "file_name", "warehouse", "customer", "period_start", "period_end", "row_count", "generated_by")
    list_filter = ("status", "warehouse")
    search_fields = ("file_name", "generated_by")
