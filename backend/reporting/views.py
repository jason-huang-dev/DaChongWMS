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
    CreditNoteFilter,
    ExternalRemittanceBatchFilter,
    FinanceExportFilter,
    InvoiceDisputeFilter,
    InvoiceFilter,
    InvoiceRemittanceFilter,
    InvoiceSettlementFilter,
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
from .models import BillingChargeEvent, BillingRateContract, CreditNote, ExternalRemittanceBatch, FinanceExport, Invoice, OperationalReportExport, StorageAccrualRun, WarehouseKpiSnapshot
from .models import InvoiceDispute, InvoiceRemittance, InvoiceSettlement
from .permissions import CanManageFinanceRecords, CanManageReportingRecords
from .serializers import (
    BillingChargeEventSerializer,
    BillingRateContractSerializer,
    CreditNoteApplyActionSerializer,
    CreditNoteSerializer,
    ExternalRemittanceBatchCreateSerializer,
    ExternalRemittanceBatchSerializer,
    FinanceExportSerializer,
    InvoiceDisputeResolveActionSerializer,
    InvoiceDisputeReviewActionSerializer,
    InvoiceDisputeSerializer,
    InvoiceFinalizeSerializer,
    InvoiceFinanceReviewActionSerializer,
    InvoiceRemittanceCreateSerializer,
    InvoiceRemittanceSerializer,
    InvoiceSerializer,
    InvoiceSettlementReviewActionSerializer,
    InvoiceSettlementSerializer,
    OperationalReportExportSerializer,
    StorageAccrualRunSerializer,
    WarehouseKpiSnapshotSerializer,
)
from .settlement_services import (
    CreditNoteApplyPayload,
    CreditNotePayload,
    DisputeResolutionPayload,
    DisputeReviewPayload,
    DisputeSubmissionPayload,
    ExternalRemittanceBatchPayload,
    ExternalRemittanceItemPayload,
    RemittancePayload,
    SettlementReviewPayload,
    SettlementSubmissionPayload,
    apply_credit_note,
    ingest_external_remittance_batch,
    issue_credit_note,
    record_invoice_remittance,
    resolve_invoice_dispute,
    review_invoice_dispute,
    review_invoice_settlement,
    submit_invoice_dispute,
    submit_invoice_settlement,
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
    queryset = Invoice.objects.select_related("warehouse", "customer", "finance_approval", "settlement").prefetch_related(
        "lines",
        "lines__charge_event",
        "disputes",
        "credit_notes",
    )
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


class InvoiceSettlementViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = InvoiceSettlement.objects.select_related("invoice", "invoice__warehouse", "invoice__customer").prefetch_related("remittances")
    serializer_class = InvoiceSettlementSerializer
    filterset_class = InvoiceSettlementFilter
    ordering_fields = ["id", "submitted_at", "due_date", "create_time"]
    search_fields = ["invoice__invoice_number", "settlement_reference", "notes", "submitted_by", "reviewed_by"]
    permission_classes = [CanManageFinanceRecords]

    def perform_create(self, serializer: InvoiceSettlementSerializer) -> None:
        operator = get_request_operator(self.request)
        settlement = submit_invoice_settlement(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=serializer.validated_data["invoice"],
            payload=SettlementSubmissionPayload(
                requested_amount=serializer.validated_data["requested_amount"],
                due_date=serializer.validated_data.get("due_date"),
                settlement_reference=serializer.validated_data.get("settlement_reference", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = settlement

    def approve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        settlement = self.get_object()
        self.check_object_permissions(request, settlement)
        serializer = InvoiceSettlementReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        settlement = review_invoice_settlement(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=settlement.invoice,
            approve=True,
            payload=SettlementReviewPayload(
                approved_amount=serializer.validated_data.get("approved_amount"),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        return Response(self.get_serializer(settlement).data, status=status.HTTP_200_OK)

    def reject(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        settlement = self.get_object()
        self.check_object_permissions(request, settlement)
        serializer = InvoiceSettlementReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        settlement = review_invoice_settlement(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=settlement.invoice,
            approve=False,
            payload=SettlementReviewPayload(notes=serializer.validated_data.get("notes", "")),
        )
        return Response(self.get_serializer(settlement).data, status=status.HTTP_200_OK)


class InvoiceRemittanceViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = InvoiceRemittance.objects.select_related("settlement", "settlement__invoice")
    serializer_class = InvoiceRemittanceSerializer
    filterset_class = InvoiceRemittanceFilter
    ordering_fields = ["id", "remitted_at", "create_time"]
    search_fields = ["remittance_reference", "settlement__invoice__invoice_number", "notes", "remitted_by"]
    permission_classes = [CanManageFinanceRecords]

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = InvoiceRemittanceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        remittance = record_invoice_remittance(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            settlement=serializer.validated_data["settlement"],
            payload=RemittancePayload(
                amount=serializer.validated_data["amount"],
                remittance_reference=serializer.validated_data["remittance_reference"],
                remitted_at=serializer.validated_data.get("remitted_at"),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        response_serializer = self.get_serializer(remittance)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class InvoiceDisputeViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = InvoiceDispute.objects.select_related("invoice", "invoice_line", "invoice__warehouse", "invoice__customer")
    serializer_class = InvoiceDisputeSerializer
    filterset_class = InvoiceDisputeFilter
    ordering_fields = ["id", "opened_at", "resolved_at", "create_time"]
    search_fields = ["invoice__invoice_number", "reference_code", "notes", "resolution_notes", "opened_by"]
    permission_classes = [CanManageFinanceRecords]

    def perform_create(self, serializer: InvoiceDisputeSerializer) -> None:
        operator = get_request_operator(self.request)
        dispute = submit_invoice_dispute(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=serializer.validated_data["invoice"],
            payload=DisputeSubmissionPayload(
                invoice_line=serializer.validated_data.get("invoice_line"),
                reason_code=serializer.validated_data["reason_code"],
                disputed_amount=serializer.validated_data["disputed_amount"],
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = dispute

    def review(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        dispute = self.get_object()
        self.check_object_permissions(request, dispute)
        serializer = InvoiceDisputeReviewActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        dispute = review_invoice_dispute(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            dispute=dispute,
            payload=DisputeReviewPayload(notes=serializer.validated_data.get("notes", "")),
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)

    def resolve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        dispute = self.get_object()
        self.check_object_permissions(request, dispute)
        serializer = InvoiceDisputeResolveActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        dispute = resolve_invoice_dispute(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            dispute=dispute,
            approve=True,
            payload=DisputeResolutionPayload(
                approved_credit_amount=serializer.validated_data.get("approved_credit_amount", 0),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)

    def reject(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        dispute = self.get_object()
        self.check_object_permissions(request, dispute)
        serializer = InvoiceDisputeResolveActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        dispute = resolve_invoice_dispute(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            dispute=dispute,
            approve=False,
            payload=DisputeResolutionPayload(notes=serializer.validated_data.get("notes", "")),
        )
        return Response(self.get_serializer(dispute).data, status=status.HTTP_200_OK)


class CreditNoteViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = CreditNote.objects.select_related("invoice", "dispute", "invoice__warehouse", "invoice__customer")
    serializer_class = CreditNoteSerializer
    filterset_class = CreditNoteFilter
    ordering_fields = ["id", "issued_at", "applied_at", "create_time"]
    search_fields = ["credit_note_number", "reference_code", "notes", "invoice__invoice_number"]
    permission_classes = [CanManageFinanceRecords]

    def perform_create(self, serializer: CreditNoteSerializer) -> None:
        operator = get_request_operator(self.request)
        credit_note = issue_credit_note(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            invoice=serializer.validated_data["invoice"],
            payload=CreditNotePayload(
                credit_note_number=serializer.validated_data["credit_note_number"],
                amount=serializer.validated_data.get("amount"),
                dispute=serializer.validated_data.get("dispute"),
                reason_code=serializer.validated_data.get("reason_code", "OTHER"),
                reference_code=serializer.validated_data.get("reference_code", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = credit_note

    def apply(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        credit_note = self.get_object()
        self.check_object_permissions(request, credit_note)
        serializer = CreditNoteApplyActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        credit_note = apply_credit_note(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            credit_note=credit_note,
            payload=CreditNoteApplyPayload(notes=serializer.validated_data.get("notes", "")),
        )
        return Response(self.get_serializer(credit_note).data, status=status.HTTP_200_OK)


class ExternalRemittanceBatchViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = ExternalRemittanceBatch.objects.prefetch_related("items", "items__remittance").all()
    serializer_class = ExternalRemittanceBatchSerializer
    filterset_class = ExternalRemittanceBatchFilter
    ordering_fields = ["id", "submitted_at", "processed_at", "create_time"]
    search_fields = ["source_system", "external_batch_id", "last_error", "notes"]
    permission_classes = [CanManageFinanceRecords]

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ExternalRemittanceBatchCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        existing_batch = ExternalRemittanceBatch.objects.filter(
            openid=self._current_openid(),
            source_system=serializer.validated_data["source_system"],
            external_batch_id=serializer.validated_data["external_batch_id"],
            is_delete=False,
        ).first()
        batch = ingest_external_remittance_batch(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=ExternalRemittanceBatchPayload(
                source_system=serializer.validated_data["source_system"],
                external_batch_id=serializer.validated_data["external_batch_id"],
                notes=serializer.validated_data.get("notes", ""),
                payload=serializer.validated_data.get("payload", {}),
                items=[
                    ExternalRemittanceItemPayload(
                        external_reference=item["external_reference"],
                        amount=item["amount"],
                        currency=item.get("currency", "USD"),
                        invoice_number=item.get("invoice_number", ""),
                        settlement_reference=item.get("settlement_reference", ""),
                        remitted_at=item.get("remitted_at"),
                        notes=item.get("notes", ""),
                        payload=item.get("payload", {}),
                    )
                    for item in serializer.validated_data["items"]
                ],
            ),
        )
        response_serializer = self.get_serializer(batch)
        status_code = status.HTTP_200_OK if existing_batch is not None else status.HTTP_201_CREATED
        return Response(response_serializer.data, status=status_code)
