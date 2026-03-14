from django_filters import rest_framework as filters

from .models import BillingChargeEvent, BillingRateContract, FinanceExport, Invoice, OperationalReportExport, StorageAccrualRun, WarehouseKpiSnapshot


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
