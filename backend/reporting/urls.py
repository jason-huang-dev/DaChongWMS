from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import (
    BillingChargeEventViewSet,
    BillingRateContractViewSet,
    CreditNoteViewSet,
    ExternalRemittanceBatchViewSet,
    FinanceExportViewSet,
    InvoiceDisputeViewSet,
    InvoiceRemittanceViewSet,
    InvoiceSettlementViewSet,
    InvoiceViewSet,
    OperationalReportExportViewSet,
    StorageAccrualRunViewSet,
    WarehouseKpiSnapshotViewSet,
)

app_name = "reporting"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("kpi-snapshots/", _action(WarehouseKpiSnapshotViewSet, {"get": "list", "post": "create"}), name="kpi-snapshot-list"),
    re_path(r"^kpi-snapshots/(?P<pk>\d+)/$", _action(WarehouseKpiSnapshotViewSet, {"get": "retrieve"}), name="kpi-snapshot-detail"),
    path("report-exports/", _action(OperationalReportExportViewSet, {"get": "list", "post": "create"}), name="report-export-list"),
    re_path(r"^report-exports/(?P<pk>\d+)/$", _action(OperationalReportExportViewSet, {"get": "retrieve"}), name="report-export-detail"),
    re_path(r"^report-exports/(?P<pk>\d+)/download/$", _action(OperationalReportExportViewSet, {"get": "download"}), name="report-export-download"),
    path("rate-contracts/", _action(BillingRateContractViewSet, {"get": "list", "post": "create"}), name="rate-contract-list"),
    re_path(
        r"^rate-contracts/(?P<pk>\d+)/$",
        _action(BillingRateContractViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="rate-contract-detail",
    ),
    path("storage-accrual-runs/", _action(StorageAccrualRunViewSet, {"get": "list", "post": "create"}), name="storage-accrual-run-list"),
    re_path(r"^storage-accrual-runs/(?P<pk>\d+)/$", _action(StorageAccrualRunViewSet, {"get": "retrieve"}), name="storage-accrual-run-detail"),
    path("billing-charge-events/", _action(BillingChargeEventViewSet, {"get": "list", "post": "create"}), name="billing-charge-event-list"),
    re_path(
        r"^billing-charge-events/(?P<pk>\d+)/$",
        _action(BillingChargeEventViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="billing-charge-event-detail",
    ),
    path("invoices/", _action(InvoiceViewSet, {"get": "list", "post": "create"}), name="invoice-list"),
    re_path(r"^invoices/(?P<pk>\d+)/$", _action(InvoiceViewSet, {"get": "retrieve"}), name="invoice-detail"),
    re_path(r"^invoices/(?P<pk>\d+)/finalize/$", _action(InvoiceViewSet, {"post": "finalize"}), name="invoice-finalize"),
    re_path(r"^invoices/(?P<pk>\d+)/submit-finance-review/$", _action(InvoiceViewSet, {"post": "submit_finance_review"}), name="invoice-submit-finance-review"),
    re_path(r"^invoices/(?P<pk>\d+)/approve-finance-review/$", _action(InvoiceViewSet, {"post": "approve_finance_review"}), name="invoice-approve-finance-review"),
    re_path(r"^invoices/(?P<pk>\d+)/reject-finance-review/$", _action(InvoiceViewSet, {"post": "reject_finance_review"}), name="invoice-reject-finance-review"),
    path("invoice-settlements/", _action(InvoiceSettlementViewSet, {"get": "list", "post": "create"}), name="invoice-settlement-list"),
    re_path(r"^invoice-settlements/(?P<pk>\d+)/$", _action(InvoiceSettlementViewSet, {"get": "retrieve"}), name="invoice-settlement-detail"),
    re_path(r"^invoice-settlements/(?P<pk>\d+)/approve/$", _action(InvoiceSettlementViewSet, {"post": "approve"}), name="invoice-settlement-approve"),
    re_path(r"^invoice-settlements/(?P<pk>\d+)/reject/$", _action(InvoiceSettlementViewSet, {"post": "reject"}), name="invoice-settlement-reject"),
    path("invoice-remittances/", _action(InvoiceRemittanceViewSet, {"get": "list", "post": "create"}), name="invoice-remittance-list"),
    re_path(r"^invoice-remittances/(?P<pk>\d+)/$", _action(InvoiceRemittanceViewSet, {"get": "retrieve"}), name="invoice-remittance-detail"),
    path("invoice-disputes/", _action(InvoiceDisputeViewSet, {"get": "list", "post": "create"}), name="invoice-dispute-list"),
    re_path(r"^invoice-disputes/(?P<pk>\d+)/$", _action(InvoiceDisputeViewSet, {"get": "retrieve"}), name="invoice-dispute-detail"),
    re_path(r"^invoice-disputes/(?P<pk>\d+)/review/$", _action(InvoiceDisputeViewSet, {"post": "review"}), name="invoice-dispute-review"),
    re_path(r"^invoice-disputes/(?P<pk>\d+)/resolve/$", _action(InvoiceDisputeViewSet, {"post": "resolve"}), name="invoice-dispute-resolve"),
    re_path(r"^invoice-disputes/(?P<pk>\d+)/reject/$", _action(InvoiceDisputeViewSet, {"post": "reject"}), name="invoice-dispute-reject"),
    path("credit-notes/", _action(CreditNoteViewSet, {"get": "list", "post": "create"}), name="credit-note-list"),
    re_path(r"^credit-notes/(?P<pk>\d+)/$", _action(CreditNoteViewSet, {"get": "retrieve"}), name="credit-note-detail"),
    re_path(r"^credit-notes/(?P<pk>\d+)/apply/$", _action(CreditNoteViewSet, {"post": "apply"}), name="credit-note-apply"),
    path(
        "external-remittance-batches/",
        _action(ExternalRemittanceBatchViewSet, {"get": "list", "post": "create"}),
        name="external-remittance-batch-list",
    ),
    re_path(
        r"^external-remittance-batches/(?P<pk>\d+)/$",
        _action(ExternalRemittanceBatchViewSet, {"get": "retrieve"}),
        name="external-remittance-batch-detail",
    ),
    path("finance-exports/", _action(FinanceExportViewSet, {"get": "list", "post": "create"}), name="finance-export-list"),
    re_path(r"^finance-exports/(?P<pk>\d+)/$", _action(FinanceExportViewSet, {"get": "retrieve"}), name="finance-export-detail"),
    re_path(r"^finance-exports/(?P<pk>\d+)/download/$", _action(FinanceExportViewSet, {"get": "download"}), name="finance-export-download"),
]
