"""Return receipt and disposition API viewsets."""

from __future__ import annotations

from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from .filter import ReturnDispositionFilter, ReturnOrderFilter, ReturnReceiptFilter
from .models import ReturnDisposition, ReturnOrder, ReturnReceipt
from .permissions import CanManageReturnRecords
from .serializers import ReturnDispositionSerializer, ReturnLineWriteSerializer, ReturnOrderSerializer, ReturnReceiptSerializer
from .services import (
    ReturnDispositionPayload,
    ReturnLinePayload,
    ReturnOrderUpdatePayload,
    ReturnReceiptPayload,
    archive_return_order,
    create_return_order,
    record_return_disposition,
    record_return_receipt,
    update_return_order,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageReturnRecords]
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


class ReturnOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = ReturnOrder.objects.select_related("warehouse", "customer", "sales_order").prefetch_related("lines", "lines__goods")
    serializer_class = ReturnOrderSerializer
    filterset_class = ReturnOrderFilter
    search_fields = ["return_number", "reference_code", "notes", "customer__customer_name"]

    def perform_create(self, serializer: ReturnOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [ReturnLinePayload(**item) for item in serializer.validated_data.pop("line_items")]
        return_order = create_return_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            customer=serializer.validated_data["customer"],
            sales_order=serializer.validated_data.get("sales_order"),
            return_number=serializer.validated_data["return_number"],
            requested_date=serializer.validated_data.get("requested_date"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = return_order

    def perform_update(self, serializer: ReturnOrderSerializer) -> None:
        return_order = update_return_order(
            openid=self._current_openid(),
            return_order=serializer.instance,
            payload=ReturnOrderUpdatePayload(
                warehouse=serializer.validated_data.get("warehouse", serializer.instance.warehouse),
                customer=serializer.validated_data.get("customer", serializer.instance.customer),
                sales_order=serializer.validated_data.get("sales_order", serializer.instance.sales_order),
                requested_date=serializer.validated_data.get("requested_date", serializer.instance.requested_date),
                reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
                notes=serializer.validated_data.get("notes", serializer.instance.notes),
                status=serializer.validated_data.get("status", serializer.instance.status),
            ),
        )
        serializer.instance = return_order

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        return_order = self.get_object()
        archive_return_order(openid=self._current_openid(), return_order=return_order)
        serializer = self.get_serializer(return_order)
        return Response(serializer.data)


class ReturnReceiptViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = ReturnReceipt.objects.select_related(
        "return_line",
        "return_line__return_order",
        "return_line__goods",
        "warehouse",
        "receipt_location",
        "inventory_movement",
    )
    serializer_class = ReturnReceiptSerializer
    filterset_class = ReturnReceiptFilter
    ordering_fields = ["id", "received_at", "create_time"]
    search_fields = ["receipt_number", "return_line__return_order__return_number", "return_line__goods__goods_code", "received_by"]

    def perform_create(self, serializer: ReturnReceiptSerializer) -> None:
        operator = get_request_operator(self.request)
        receipt = record_return_receipt(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=ReturnReceiptPayload(
                return_line=serializer.validated_data["return_line"],
                warehouse=serializer.validated_data["warehouse"],
                receipt_location=serializer.validated_data["receipt_location"],
                receipt_number=serializer.validated_data["receipt_number"],
                received_qty=serializer.validated_data["received_qty"],
                stock_status=serializer.validated_data.get("stock_status"),
                lot_number=serializer.validated_data.get("lot_number", ""),
                serial_number=serializer.validated_data.get("serial_number", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = receipt


class ReturnDispositionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = ReturnDisposition.objects.select_related(
        "return_receipt",
        "return_receipt__return_line",
        "return_receipt__return_line__return_order",
        "return_receipt__return_line__goods",
        "warehouse",
        "to_location",
        "inventory_movement",
    )
    serializer_class = ReturnDispositionSerializer
    filterset_class = ReturnDispositionFilter
    ordering_fields = ["id", "completed_at", "create_time"]
    search_fields = ["disposition_number", "return_receipt__receipt_number", "return_receipt__return_line__return_order__return_number", "completed_by"]

    def perform_create(self, serializer: ReturnDispositionSerializer) -> None:
        operator = get_request_operator(self.request)
        disposition = record_return_disposition(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=ReturnDispositionPayload(
                return_receipt=serializer.validated_data["return_receipt"],
                warehouse=serializer.validated_data["warehouse"],
                disposition_number=serializer.validated_data["disposition_number"],
                disposition_type=serializer.validated_data["disposition_type"],
                quantity=serializer.validated_data["quantity"],
                to_location=serializer.validated_data.get("to_location"),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = disposition
