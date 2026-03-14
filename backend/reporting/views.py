"""API viewsets for KPI snapshots, operational exports, and billing events."""

from __future__ import annotations

from typing import Any, Sequence

from django.http import HttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from .billing_services import BillingChargePayload, record_charge_event, update_charge_event
from .filter import (
    BillingChargeEventFilter,
    BillingRateContractFilter,
    FinanceExportFilter,
    InvoiceFilter,
    OperationalReportExportFilter,
    StorageAccrualRunFilter,
    WarehouseKpiSnapshotFilter,
)
from .invoicing_services import (
    InvoiceFinanceReviewPayload,
    InvoiceGenerationPayload,
    finalize_invoice,
    generate_invoice,
    review_invoice_for_finance,
    submit_invoice_for_finance_review,
)
from .models import BillingChargeEvent, BillingRateContract, FinanceExport, Invoice, OperationalReportExport, StorageAccrualRun, WarehouseKpiSnapshot
from .permissions import CanManageFinanceRecords, CanManageReportingRecords
from .serializers import (
    BillingChargeEventSerializer,
    BillingRateContractSerializer,
    FinanceExportSerializer,
    InvoiceFinalizeSerializer,
    InvoiceFinanceReviewActionSerializer,
    InvoiceSerializer,
    OperationalReportExportSerializer,
    StorageAccrualRunSerializer,
    WarehouseKpiSnapshotSerializer,
)
from .services import (
    FinanceExportPayload,
    KpiSnapshotPayload,
    OperationalReportPayload,
    StorageAccrualPayload,
    generate_finance_export,
    generate_operational_report,
    generate_storage_accrual_run,
    generate_warehouse_kpi_snapshot,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageReportingRecords]
    queryset = None

    def get_queryset(self):  # type: ignore[override]
        assert self.queryset is not None
        openid = getattr(self.request.auth, "openid", None)
        queryset = self.queryset.filter(openid=openid, is_delete=False)
        pk = self.kwargs.get("pk")
        if pk is not None:
            return queryset.filter(pk=pk)
        return queryset

    def _current_openid(self) -> str:
        openid = getattr(self.request.auth, "openid", None)
        if not isinstance(openid, str) or not openid:
            raise APIException({"detail": "Authentication token missing openid"})
        return openid


class WarehouseKpiSnapshotViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = WarehouseKpiSnapshot.objects.select_related("warehouse")
    serializer_class = WarehouseKpiSnapshotSerializer
    filterset_class = WarehouseKpiSnapshotFilter
    ordering_fields = ["id", "snapshot_date", "generated_at", "create_time"]
    search_fields = ["warehouse__warehouse_name", "generated_by"]

    def perform_create(self, serializer: WarehouseKpiSnapshotSerializer) -> None:
        operator = get_request_operator(self.request)
        snapshot = generate_warehouse_kpi_snapshot(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=KpiSnapshotPayload(
                warehouse=serializer.validated_data["warehouse"],
                snapshot_date=serializer.validated_data["snapshot_date"],
            ),
        )
        serializer.instance = snapshot


class OperationalReportExportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = OperationalReportExport.objects.select_related("warehouse")
    serializer_class = OperationalReportExportSerializer
    filterset_class = OperationalReportExportFilter
    ordering_fields = ["id", "generated_at", "create_time"]
    search_fields = ["report_type", "file_name", "generated_by"]

    def perform_create(self, serializer: OperationalReportExportSerializer) -> None:
        operator = get_request_operator(self.request)
        export = generate_operational_report(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=OperationalReportPayload(
                warehouse=serializer.validated_data.get("warehouse"),
                report_type=serializer.validated_data["report_type"],
                date_from=serializer.validated_data.get("date_from"),
                date_to=serializer.validated_data.get("date_to"),
                parameters=serializer.validated_data.get("parameters", {}),
            ),
        )
        serializer.instance = export

    def download(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        export = self.get_object()
        response = HttpResponse(export.content, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{export.file_name}"'
        return response


class BillingChargeEventViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = BillingChargeEvent.objects.select_related("warehouse", "customer")
    serializer_class = BillingChargeEventSerializer
    filterset_class = BillingChargeEventFilter
    ordering_fields = ["id", "event_date", "create_time"]
    search_fields = ["reference_code", "source_module", "notes"]

    def perform_create(self, serializer: BillingChargeEventSerializer) -> None:
        operator = get_request_operator(self.request)
        charge_event = record_charge_event(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=BillingChargePayload(
                warehouse=serializer.validated_data["warehouse"],
                customer=serializer.validated_data.get("customer"),
                charge_type=serializer.validated_data["charge_type"],
                event_date=serializer.validated_data["event_date"],
                quantity=serializer.validated_data["quantity"],
                uom=serializer.validated_data.get("uom", "EA"),
                unit_rate=serializer.validated_data.get("unit_rate"),
                currency=serializer.validated_data.get("currency", "USD"),
                status=serializer.validated_data.get("status"),
                source_module=serializer.validated_data.get("source_module", ""),
                source_record_type=serializer.validated_data.get("source_record_type", ""),
                source_record_id=serializer.validated_data.get("source_record_id"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = charge_event

    def perform_update(self, serializer: BillingChargeEventSerializer) -> None:
        charge_event = update_charge_event(
            openid=self._current_openid(),
            charge_event=serializer.instance,
            quantity=serializer.validated_data.get("quantity", serializer.instance.quantity),
            unit_rate=serializer.validated_data.get("unit_rate", serializer.instance.unit_rate),
            status=serializer.validated_data.get("status", serializer.instance.status),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
        )
        serializer.instance = charge_event


class BillingRateContractViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = BillingRateContract.objects.select_related("warehouse", "customer")
    serializer_class = BillingRateContractSerializer
    filterset_class = BillingRateContractFilter
    ordering_fields = ["id", "priority", "effective_from", "create_time"]
    search_fields = ["contract_name", "charge_type", "notes"]

    def perform_create(self, serializer: BillingRateContractSerializer) -> None:
        operator = get_request_operator(self.request)
        serializer.save(creator=operator.staff_name, openid=self._current_openid())

    def perform_update(self, serializer: BillingRateContractSerializer) -> None:
        serializer.save()


class StorageAccrualRunViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = StorageAccrualRun.objects.select_related("warehouse", "customer", "charge_event")
    serializer_class = StorageAccrualRunSerializer
    filterset_class = StorageAccrualRunFilter
    ordering_fields = ["id", "accrual_date", "generated_at", "create_time"]
    search_fields = ["notes", "generated_by"]

    def perform_create(self, serializer: StorageAccrualRunSerializer) -> None:
        operator = get_request_operator(self.request)
        accrual_run = generate_storage_accrual_run(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=StorageAccrualPayload(
                warehouse=serializer.validated_data["warehouse"],
                customer=serializer.validated_data["customer"],
                accrual_date=serializer.validated_data["accrual_date"],
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = accrual_run


class InvoiceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = Invoice.objects.select_related("warehouse", "customer", "finance_approval").prefetch_related("lines", "lines__charge_event")
    serializer_class = InvoiceSerializer
    filterset_class = InvoiceFilter
    ordering_fields = ["id", "generated_at", "period_start", "period_end", "create_time"]
    search_fields = ["invoice_number", "customer__customer_name", "notes"]

    def get_permissions(self):  # type: ignore[override]
        if getattr(self, "action", "") in {"submit_finance_review", "approve_finance_review", "reject_finance_review"}:
            return [CanManageFinanceRecords()]
        return super().get_permissions()

    def perform_create(self, serializer: InvoiceSerializer) -> None:
        operator = get_request_operator(self.request)
        invoice = generate_invoice(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=InvoiceGenerationPayload(
                warehouse=serializer.validated_data["warehouse"],
                customer=serializer.validated_data.get("customer"),
                period_start=serializer.validated_data["period_start"],
                period_end=serializer.validated_data["period_end"],
                invoice_number=serializer.validated_data["invoice_number"],
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = invoice

    def finalize(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self.get_object()
        self.check_object_permissions(request, invoice)
        serializer = InvoiceFinalizeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        invoice = finalize_invoice(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=invoice,
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(self.get_serializer(invoice).data, status=status.HTTP_200_OK)

    def submit_finance_review(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self.get_object()
        self.check_object_permissions(request, invoice)
        serializer = InvoiceFinanceReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        submit_invoice_for_finance_review(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=invoice,
            payload=InvoiceFinanceReviewPayload(notes=serializer.validated_data.get("notes", "")),
        )
        invoice.refresh_from_db()
        return Response(self.get_serializer(invoice).data, status=status.HTTP_200_OK)

    def approve_finance_review(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self.get_object()
        self.check_object_permissions(request, invoice)
        serializer = InvoiceFinanceReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        review_invoice_for_finance(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=invoice,
            approve=True,
            payload=InvoiceFinanceReviewPayload(notes=serializer.validated_data.get("notes", "")),
        )
        invoice.refresh_from_db()
        return Response(self.get_serializer(invoice).data, status=status.HTTP_200_OK)

    def reject_finance_review(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        invoice = self.get_object()
        self.check_object_permissions(request, invoice)
        serializer = InvoiceFinanceReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        review_invoice_for_finance(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=invoice,
            approve=False,
            payload=InvoiceFinanceReviewPayload(notes=serializer.validated_data.get("notes", "")),
        )
        invoice.refresh_from_db()
        return Response(self.get_serializer(invoice).data, status=status.HTTP_200_OK)


class FinanceExportViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = FinanceExport.objects.select_related("warehouse", "customer")
    serializer_class = FinanceExportSerializer
    filterset_class = FinanceExportFilter
    ordering_fields = ["id", "generated_at", "period_start", "period_end", "create_time"]
    search_fields = ["file_name", "generated_by"]

    def get_permissions(self):  # type: ignore[override]
        if getattr(self, "action", "") == "create":
            return [CanManageFinanceRecords()]
        return super().get_permissions()

    def perform_create(self, serializer: FinanceExportSerializer) -> None:
        operator = get_request_operator(self.request)
        export = generate_finance_export(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=FinanceExportPayload(
                warehouse=serializer.validated_data.get("warehouse"),
                customer=serializer.validated_data.get("customer"),
                period_start=serializer.validated_data["period_start"],
                period_end=serializer.validated_data["period_end"],
                parameters=serializer.validated_data.get("parameters", {}),
            ),
        )
        serializer.instance = export

    def download(self, request: Request, *args: Any, **kwargs: Any) -> HttpResponse:
        export = self.get_object()
        response = HttpResponse(export.content, content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{export.file_name}"'
        return response
