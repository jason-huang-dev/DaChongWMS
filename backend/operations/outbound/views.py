"""Outbound API viewsets."""

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

from .filter import DockLoadVerificationFilter, PickTaskFilter, SalesOrderFilter, ShipmentFilter
from .models import DockLoadVerification, PickTask, SalesOrder, Shipment
from .permissions import CanManageOutboundRecords
from .serializers import (
    DockLoadVerificationSerializer,
    PickTaskCompleteSerializer,
    PickTaskSerializer,
    ScanPickSerializer,
    ScanShipmentSerializer,
    SalesOrderAllocateSerializer,
    SalesOrderSerializer,
    ShipmentSerializer,
)
from .services import (
    SalesOrderLinePayload,
    ShipmentLinePayload,
    allocate_sales_order,
    archive_sales_order,
    complete_pick_task,
    create_sales_order,
    create_shipment,
    scan_complete_pick_task,
    scan_ship_sales_order,
    update_pick_task,
    update_sales_order,
    PickTaskUpdatePayload,
    ScanPickPayload,
    ScanShipmentPayload,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageOutboundRecords]
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


class SalesOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = SalesOrder.objects.select_related("warehouse", "customer", "staging_location").prefetch_related("lines", "lines__goods")
    serializer_class = SalesOrderSerializer
    filterset_class = SalesOrderFilter
    search_fields = ["order_number", "reference_code", "notes", "customer__customer_name"]

    def perform_create(self, serializer: SalesOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [SalesOrderLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        sales_order = create_sales_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            customer=serializer.validated_data["customer"],
            staging_location=serializer.validated_data["staging_location"],
            order_number=serializer.validated_data["order_number"],
            requested_ship_date=serializer.validated_data.get("requested_ship_date"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = sales_order

    def perform_update(self, serializer: SalesOrderSerializer) -> None:
        sales_order = update_sales_order(
            openid=self._current_openid(),
            sales_order=serializer.instance,
            warehouse=serializer.validated_data.get("warehouse", serializer.instance.warehouse),
            customer=serializer.validated_data.get("customer", serializer.instance.customer),
            staging_location=serializer.validated_data.get("staging_location", serializer.instance.staging_location),
            requested_ship_date=serializer.validated_data.get("requested_ship_date", serializer.instance.requested_ship_date),
            reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
            status=serializer.validated_data.get("status", serializer.instance.status),
        )
        serializer.instance = sales_order

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        sales_order = self.get_object()
        archive_sales_order(openid=self._current_openid(), sales_order=sales_order)
        serializer = self.get_serializer(sales_order)
        return Response(serializer.data)

    def allocate(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        sales_order = self.get_object()
        self.check_object_permissions(request, sales_order)
        serializer = SalesOrderAllocateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        result = allocate_sales_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            sales_order=sales_order,
            assigned_to=serializer.validated_data.get("assigned_to"),
        )
        response_serializer = self.get_serializer(result.sales_order)
        payload = dict(response_serializer.data)
        payload["allocated_tasks"] = result.allocated_tasks
        return Response(payload, status=status.HTTP_200_OK)


class PickTaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = PickTask.objects.select_related(
        "sales_order_line",
        "sales_order_line__sales_order",
        "warehouse",
        "goods",
        "from_location",
        "to_location",
        "assigned_to",
        "inventory_movement",
        "license_plate",
    )
    serializer_class = PickTaskSerializer
    filterset_class = PickTaskFilter
    search_fields = ["task_number", "goods__goods_code", "from_location__location_code", "to_location__location_code"]

    def perform_update(self, serializer: PickTaskSerializer) -> None:
        assigned_to = serializer.validated_data.get("assigned_to", serializer.instance.assigned_to)
        to_location = serializer.validated_data.get("to_location", serializer.instance.to_location)
        notes = serializer.validated_data.get("notes", serializer.instance.notes)
        status_value = serializer.validated_data.get("status", serializer.instance.status)
        task = update_pick_task(
            openid=self._current_openid(),
            pick_task=serializer.instance,
            payload=PickTaskUpdatePayload(
                assigned_to=assigned_to,
                to_location=to_location,
                status=status_value,
                notes=notes,
            ),
        )
        serializer.instance = task

    def complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        pick_task = self.get_object()
        self.check_object_permissions(request, pick_task)
        serializer = PickTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        pick_task = complete_pick_task(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            pick_task=pick_task,
            to_location=serializer.validated_data.get("to_location"),
        )
        response_serializer = self.get_serializer(pick_task)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scan_complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ScanPickSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        pick_task = scan_complete_pick_task(
            openid=self._current_openid(),
            operator=operator,
            payload=ScanPickPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(pick_task).data, status=status.HTTP_200_OK)


class ShipmentViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = Shipment.objects.select_related("sales_order", "warehouse", "staging_location").prefetch_related(
        "lines",
        "lines__goods",
        "lines__sales_order_line",
        "lines__from_location",
        "lines__license_plate",
    )
    serializer_class = ShipmentSerializer
    filterset_class = ShipmentFilter
    ordering_fields = ["id", "shipped_at", "create_time"]
    search_fields = ["shipment_number", "reference_code", "sales_order__order_number", "shipped_by"]

    def perform_create(self, serializer: ShipmentSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [ShipmentLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        shipment = create_shipment(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            sales_order=serializer.validated_data["sales_order"],
            warehouse=serializer.validated_data["warehouse"],
            staging_location=serializer.validated_data["staging_location"],
            shipment_number=serializer.validated_data["shipment_number"],
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = shipment

    def scan_ship(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = ScanShipmentSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        sales_order = SalesOrder.objects.filter(
            openid=self._current_openid(),
            order_number=serializer.validated_data["sales_order_number"],
            is_delete=False,
        ).select_related("warehouse").first()
        if sales_order is None:
            raise APIException({"detail": "Scanned sales order was not found"})
        shipment = scan_ship_sales_order(
            openid=self._current_openid(),
            operator=operator,
            warehouse=sales_order.warehouse,
            payload=ScanShipmentPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(shipment).data, status=status.HTTP_201_CREATED)


class DockLoadVerificationViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = DockLoadVerification.objects.select_related(
        "shipment",
        "shipment_line",
        "warehouse",
        "dock_location",
        "goods",
        "license_plate",
    )
    serializer_class = DockLoadVerificationSerializer
    filterset_class = DockLoadVerificationFilter
    ordering_fields = ["verified_at", "create_time"]
    search_fields = ["shipment__shipment_number", "goods__goods_code", "trailer_reference", "verified_by"]
