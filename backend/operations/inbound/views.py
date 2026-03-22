"""Inbound API viewsets."""

from __future__ import annotations

from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from operations.order_types import OperationOrderType

from .filter import (
    AdvanceShipmentNoticeFilter,
    InboundImportBatchFilter,
    InboundSigningRecordFilter,
    PurchaseOrderFilter,
    PutawayTaskFilter,
    ReceiptFilter,
)
from .models import AdvanceShipmentNotice, InboundImportBatch, InboundSigningRecord, PurchaseOrder, PutawayTask, PutawayTaskStatus, Receipt
from .permissions import CanManageInboundRecords
from .serializers import (
    AdvanceShipmentNoticeSerializer,
    InboundImportBatchSerializer,
    InboundImportBatchUploadSerializer,
    InboundSigningRecordSerializer,
    PurchaseOrderSerializer,
    PutawayTaskCompleteSerializer,
    PutawayTaskSerializer,
    ReceiptSerializer,
    ScanPutawaySerializer,
    ScanReceiptSerializer,
    ScanSigningSerializer,
)
from .services import (
    AdvanceShipmentNoticeLinePayload,
    PurchaseOrderLinePayload,
    PutawayTaskUpdatePayload,
    ReceiptLinePayload,
    archive_purchase_order,
    complete_putaway_task,
    create_advance_shipment_notice,
    create_purchase_order,
    import_stock_in_manifest,
    record_receipt,
    scan_complete_putaway_task,
    scan_receive_goods,
    scan_sign_inbound,
    update_advance_shipment_notice,
    update_purchase_order,
    update_putaway_task,
    ScanPutawayPayload,
    ScanReceiptPayload,
    ScanSignPayload,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageInboundRecords]
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


class PurchaseOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = PurchaseOrder.objects.select_related("warehouse", "supplier").prefetch_related("lines", "lines__goods")
    serializer_class = PurchaseOrderSerializer
    filterset_class = PurchaseOrderFilter
    search_fields = ["po_number", "reference_code", "notes", "supplier__supplier_name"]

    def perform_create(self, serializer: PurchaseOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [PurchaseOrderLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        purchase_order = create_purchase_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            supplier=serializer.validated_data["supplier"],
            order_type=serializer.validated_data.get("order_type", OperationOrderType.STANDARD),
            po_number=serializer.validated_data["po_number"],
            expected_arrival_date=serializer.validated_data.get("expected_arrival_date"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = purchase_order

    def perform_update(self, serializer: PurchaseOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        purchase_order = update_purchase_order(
            openid=self._current_openid(),
            purchase_order=serializer.instance,
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data.get("warehouse", serializer.instance.warehouse),
            supplier=serializer.validated_data.get("supplier", serializer.instance.supplier),
            expected_arrival_date=serializer.validated_data.get(
                "expected_arrival_date",
                serializer.instance.expected_arrival_date,
            ),
            reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
            status=serializer.validated_data.get("status", serializer.instance.status),
        )
        serializer.instance = purchase_order

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        purchase_order = self.get_object()
        archive_purchase_order(openid=self._current_openid(), purchase_order=purchase_order)
        serializer = self.get_serializer(purchase_order)
        return Response(serializer.data)


class AdvanceShipmentNoticeViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = AdvanceShipmentNotice.objects.select_related("purchase_order", "warehouse", "supplier").prefetch_related("lines", "lines__goods")
    serializer_class = AdvanceShipmentNoticeSerializer
    filterset_class = AdvanceShipmentNoticeFilter
    search_fields = ["asn_number", "reference_code", "notes", "supplier__supplier_name"]

    def perform_create(self, serializer: AdvanceShipmentNoticeSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [AdvanceShipmentNoticeLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        asn = create_advance_shipment_notice(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            purchase_order=serializer.validated_data["purchase_order"],
            warehouse=serializer.validated_data["warehouse"],
            supplier=serializer.validated_data["supplier"],
            asn_number=serializer.validated_data["asn_number"],
            expected_arrival_date=serializer.validated_data.get("expected_arrival_date"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = asn

    def perform_update(self, serializer: AdvanceShipmentNoticeSerializer) -> None:
        asn = update_advance_shipment_notice(
            openid=self._current_openid(),
            asn=serializer.instance,
            warehouse=serializer.validated_data.get("warehouse", serializer.instance.warehouse),
            supplier=serializer.validated_data.get("supplier", serializer.instance.supplier),
            expected_arrival_date=serializer.validated_data.get("expected_arrival_date", serializer.instance.expected_arrival_date),
            reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
            status=serializer.validated_data.get("status", serializer.instance.status),
        )
        serializer.instance = asn


class ReceiptViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = Receipt.objects.select_related("asn", "purchase_order", "warehouse", "receipt_location").prefetch_related(
        "lines",
        "lines__goods",
        "lines__purchase_order_line",
    )
    serializer_class = ReceiptSerializer
    filterset_class = ReceiptFilter
    ordering_fields = ["id", "received_at", "create_time"]
    search_fields = ["receipt_number", "reference_code", "purchase_order__po_number", "received_by"]

    def perform_create(self, serializer: ReceiptSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [ReceiptLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        receipt = record_receipt(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            purchase_order=serializer.validated_data["purchase_order"],
            warehouse=serializer.validated_data["warehouse"],
            receipt_location=serializer.validated_data["receipt_location"],
            receipt_number=serializer.validated_data["receipt_number"],
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = receipt

    def scan_receive(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ScanReceiptSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        warehouse = None
        if serializer.validated_data.get("asn_number"):
            asn = AdvanceShipmentNotice.objects.filter(
                openid=self._current_openid(),
                asn_number=serializer.validated_data["asn_number"],
                is_delete=False,
            ).select_related("warehouse").first()
            if asn is None:
                raise APIException({"detail": "Scanned ASN was not found"})
            warehouse = asn.warehouse
        else:
            purchase_order = PurchaseOrder.objects.filter(
                openid=self._current_openid(),
                po_number=serializer.validated_data["purchase_order_number"],
                is_delete=False,
            ).select_related("warehouse").first()
            if purchase_order is None:
                raise APIException({"detail": "Scanned purchase order was not found"})
            warehouse = purchase_order.warehouse
        receipt = scan_receive_goods(
            openid=self._current_openid(),
            operator=operator,
            warehouse=warehouse,
            payload=ScanReceiptPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(receipt).data, status=status.HTTP_201_CREATED)


class PutawayTaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = PutawayTask.objects.select_related(
        "receipt_line",
        "receipt_line__receipt",
        "warehouse",
        "goods",
        "from_location",
        "to_location",
        "assigned_to",
        "inventory_movement",
        "license_plate",
    )
    serializer_class = PutawayTaskSerializer
    filterset_class = PutawayTaskFilter
    search_fields = ["task_number", "goods__goods_code", "from_location__location_code", "to_location__location_code"]

    def perform_update(self, serializer: PutawayTaskSerializer) -> None:
        assigned_to = serializer.validated_data.get("assigned_to", serializer.instance.assigned_to)
        to_location = serializer.validated_data.get("to_location", serializer.instance.to_location)
        notes = serializer.validated_data.get("notes", serializer.instance.notes)
        status_value = serializer.validated_data.get("status", serializer.instance.status)
        task = update_putaway_task(
            openid=self._current_openid(),
            putaway_task=serializer.instance,
            payload=PutawayTaskUpdatePayload(
                assigned_to=assigned_to,
                to_location=to_location,
                status=status_value,
                notes=notes,
            ),
        )
        serializer.instance = task

    def complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        task = self.get_object()
        self.check_object_permissions(request, task)
        serializer = PutawayTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        task = complete_putaway_task(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            putaway_task=task,
            to_location=serializer.validated_data.get("to_location"),
        )
        response_serializer = self.get_serializer(task)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scan_complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ScanPutawaySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        task = scan_complete_putaway_task(
            openid=self._current_openid(),
            operator=operator,
            payload=ScanPutawayPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(task).data, status=status.HTTP_200_OK)


class InboundSigningRecordViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = InboundSigningRecord.objects.select_related("asn", "purchase_order", "warehouse")
    serializer_class = InboundSigningRecordSerializer
    filterset_class = InboundSigningRecordFilter
    ordering_fields = ["id", "signed_at", "create_time"]
    search_fields = [
        "signing_number",
        "reference_code",
        "carrier_name",
        "vehicle_plate",
        "signed_by",
        "purchase_order__po_number",
        "asn__asn_number",
    ]

    def scan_sign(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ScanSigningSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        signing_record = scan_sign_inbound(
            openid=self._current_openid(),
            operator=operator,
            payload=ScanSignPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(signing_record).data, status=status.HTTP_201_CREATED)


class InboundImportBatchViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = InboundImportBatch.objects.all()
    serializer_class = InboundImportBatchSerializer
    filterset_class = InboundImportBatchFilter
    ordering_fields = ["id", "imported_at", "create_time"]
    parser_classes = [MultiPartParser, FormParser]
    search_fields = ["batch_number", "file_name", "imported_by", "summary"]

    def upload(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = InboundImportBatchUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        batch = import_stock_in_manifest(
            openid=self._current_openid(),
            operator=operator,
            uploaded_file=serializer.validated_data["file"],
        )
        return Response(self.get_serializer(batch).data, status=status.HTTP_201_CREATED)
