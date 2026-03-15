from django_filters import rest_framework as filters

from .models import (
    BillingChargeEvent,
    BillingRateContract,
    CreditNote,
    ExternalRemittanceBatch,
    FinanceExport,
    Invoice,
    InvoiceDispute,
    InvoiceRemittance,
    InvoiceSettlement,
    OperationalReportExport,
    StorageAccrualRun,
    WarehouseKpiSnapshot,
)


class WarehouseKpiSnapshotFilter(filters.FilterSet):
    class Meta:
        model = WarehouseKpiSnapshot
        fields = {
            "warehouse": ["exact"],
            "snapshot_date": ["exact", "gte", "lte"],
        }


class OperationalReportExportFilter(filters.FilterSet):
    class Meta:
        model = OperationalReportExport
        fields = {
            "warehouse": ["exact"],
            "report_type": ["exact"],
            "status": ["exact"],
            "date_from": ["exact", "gte", "lte"],
            "date_to": ["exact", "gte", "lte"],
        }


class BillingChargeEventFilter(filters.FilterSet):
    class Meta:
        model = BillingChargeEvent
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "charge_type": ["exact"],
            "status": ["exact"],
            "event_date": ["exact", "gte", "lte"],
            "reference_code": ["exact", "icontains"],
            "source_module": ["exact", "icontains"],
        }


class BillingRateContractFilter(filters.FilterSet):
    class Meta:
        model = BillingRateContract
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "charge_type": ["exact"],
            "is_active": ["exact"],
            "effective_from": ["exact", "lte", "gte"],
            "effective_to": ["exact", "lte", "gte"],
        }


class StorageAccrualRunFilter(filters.FilterSet):
    class Meta:
        model = StorageAccrualRun
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "status": ["exact"],
            "accrual_date": ["exact", "gte", "lte"],
        }


class InvoiceFilter(filters.FilterSet):
    class Meta:
        model = Invoice
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "status": ["exact"],
            "period_start": ["exact", "gte", "lte"],
            "period_end": ["exact", "gte", "lte"],
            "invoice_number": ["exact", "icontains"],
        }


class FinanceExportFilter(filters.FilterSet):
    class Meta:
        model = FinanceExport
        fields = {
            "warehouse": ["exact"],
            "customer": ["exact"],
            "status": ["exact"],
            "period_start": ["exact", "gte", "lte"],
            "period_end": ["exact", "gte", "lte"],
        }


class InvoiceSettlementFilter(filters.FilterSet):
    class Meta:
        model = InvoiceSettlement
        fields = {
            "invoice": ["exact"],
            "status": ["exact"],
            "due_date": ["exact", "gte", "lte"],
            "submitted_at": ["gte", "lte"],
            "reviewed_at": ["gte", "lte"],
        }


class InvoiceRemittanceFilter(filters.FilterSet):
    class Meta:
        model = InvoiceRemittance
        fields = {
            "settlement": ["exact"],
            "settlement__invoice": ["exact"],
            "status": ["exact"],
            "remitted_at": ["gte", "lte"],
            "remittance_reference": ["exact", "icontains"],
        }


class InvoiceDisputeFilter(filters.FilterSet):
    class Meta:
        model = InvoiceDispute
        fields = {
            "invoice": ["exact"],
            "invoice_line": ["exact"],
            "status": ["exact"],
            "reason_code": ["exact"],
            "reference_code": ["exact", "icontains"],
            "opened_at": ["gte", "lte"],
            "resolved_at": ["gte", "lte"],
        }


class CreditNoteFilter(filters.FilterSet):
    class Meta:
        model = CreditNote
        fields = {
            "invoice": ["exact"],
            "dispute": ["exact"],
            "status": ["exact"],
            "reason_code": ["exact"],
            "credit_note_number": ["exact", "icontains"],
            "issued_at": ["gte", "lte"],
        }


class ExternalRemittanceBatchFilter(filters.FilterSet):
    class Meta:
        model = ExternalRemittanceBatch
        fields = {
            "source_system": ["exact", "icontains"],
            "external_batch_id": ["exact", "icontains"],
            "status": ["exact"],
            "submitted_at": ["gte", "lte"],
            "processed_at": ["gte", "lte"],
        }
