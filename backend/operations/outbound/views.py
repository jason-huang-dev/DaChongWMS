"""Outbound API viewsets."""

from __future__ import annotations

from decimal import Decimal
from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from operations.order_types import OperationOrderType

from .filter import (
    DockLoadVerificationFilter,
    LogisticsTrackingEventFilter,
    OutboundWaveFilter,
    PackageExecutionRecordFilter,
    PickTaskFilter,
    SalesOrderFilter,
    ShipmentDocumentRecordFilter,
    ShipmentFilter,
    ShortPickRecordFilter,
)
from .models import (
    DockLoadVerification,
    LogisticsTrackingEvent,
    OutboundWave,
    PackageExecutionRecord,
    PickTask,
    SalesOrder,
    SalesOrderExceptionState,
    Shipment,
    ShipmentDocumentRecord,
    ShortPickRecord,
)
from .permissions import CanManageOutboundRecords
from .serializers import (
    DockLoadVerificationSerializer,
    LogisticsTrackingEventSerializer,
    OutboundWaveSerializer,
    PackageExecutionRecordSerializer,
    PickTaskCompleteSerializer,
    PickTaskShortPickReportSerializer,
    PickTaskSerializer,
    ScanPickSerializer,
    ScanShipmentSerializer,
    SalesOrderAllocateSerializer,
    SalesOrderSerializer,
    ShipmentSerializer,
    ShipmentDocumentRecordSerializer,
    ShortPickRecordSerializer,
    ShortPickResolveSerializer,
)
from .services import (
    LogisticsTrackingPayload,
    PackageExecutionPayload,
    SalesOrderLinePayload,
    ShipmentLinePayload,
    ShipmentDocumentPayload,
    WaveUpdatePayload,
    allocate_sales_order,
    archive_sales_order,
    complete_pick_task,
    create_outbound_wave,
    create_shipment_document,
    create_sales_order,
    create_shipment,
    record_logistics_tracking_event,
    record_package_execution,
    scan_complete_pick_task,
    scan_ship_sales_order,
    update_pick_task,
    update_outbound_wave,
    update_sales_order,
    PickTaskUpdatePayload,
    ScanPickPayload,
    ScanShipmentPayload,
    ShortPickReportPayload,
    ShortPickResolvePayload,
    report_short_pick,
    resolve_short_pick_record,
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
    search_fields = [
        "order_number",
        "reference_code",
        "tracking_number",
        "waybill_number",
        "receiver_name",
        "deliverer_name",
        "notes",
        "customer__customer_name",
    ]

    def perform_create(self, serializer: SalesOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [SalesOrderLinePayload(**line_item) for line_item in serializer.validated_data.pop("line_items")]
        sales_order = create_sales_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            customer=serializer.validated_data["customer"],
            staging_location=serializer.validated_data["staging_location"],
            order_type=serializer.validated_data.get("order_type", OperationOrderType.DROPSHIP),
            order_number=serializer.validated_data["order_number"],
            order_time=serializer.validated_data.get("order_time"),
            requested_ship_date=serializer.validated_data.get("requested_ship_date"),
            expires_at=serializer.validated_data.get("expires_at"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            package_count=serializer.validated_data.get("package_count", 0),
            package_type=serializer.validated_data.get("package_type", ""),
            package_weight=serializer.validated_data.get("package_weight", Decimal("0.0000")),
            package_length=serializer.validated_data.get("package_length", Decimal("0.0000")),
            package_width=serializer.validated_data.get("package_width", Decimal("0.0000")),
            package_height=serializer.validated_data.get("package_height", Decimal("0.0000")),
            package_volume=serializer.validated_data.get("package_volume", Decimal("0.0000")),
            logistics_provider=serializer.validated_data.get("logistics_provider", ""),
            shipping_method=serializer.validated_data.get("shipping_method", ""),
            tracking_number=serializer.validated_data.get("tracking_number", ""),
            waybill_number=serializer.validated_data.get("waybill_number", ""),
            waybill_printed=serializer.validated_data.get("waybill_printed", False),
            deliverer_name=serializer.validated_data.get("deliverer_name", ""),
            deliverer_phone=serializer.validated_data.get("deliverer_phone", ""),
            receiver_name=serializer.validated_data.get("receiver_name", ""),
            receiver_phone=serializer.validated_data.get("receiver_phone", ""),
            receiver_country=serializer.validated_data.get("receiver_country", ""),
            receiver_state=serializer.validated_data.get("receiver_state", ""),
            receiver_city=serializer.validated_data.get("receiver_city", ""),
            receiver_address=serializer.validated_data.get("receiver_address", ""),
            receiver_postal_code=serializer.validated_data.get("receiver_postal_code", ""),
            packed_at=serializer.validated_data.get("packed_at"),
            exception_state=serializer.validated_data.get("exception_state", SalesOrderExceptionState.NORMAL),
            exception_notes=serializer.validated_data.get("exception_notes", ""),
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
            order_time=serializer.validated_data.get("order_time", serializer.instance.order_time),
            requested_ship_date=serializer.validated_data.get("requested_ship_date", serializer.instance.requested_ship_date),
            expires_at=serializer.validated_data.get("expires_at", serializer.instance.expires_at),
            reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
            package_count=serializer.validated_data.get("package_count", serializer.instance.package_count),
            package_type=serializer.validated_data.get("package_type", serializer.instance.package_type),
            package_weight=serializer.validated_data.get("package_weight", serializer.instance.package_weight),
            package_length=serializer.validated_data.get("package_length", serializer.instance.package_length),
            package_width=serializer.validated_data.get("package_width", serializer.instance.package_width),
            package_height=serializer.validated_data.get("package_height", serializer.instance.package_height),
            package_volume=serializer.validated_data.get("package_volume", serializer.instance.package_volume),
            logistics_provider=serializer.validated_data.get("logistics_provider", serializer.instance.logistics_provider),
            shipping_method=serializer.validated_data.get("shipping_method", serializer.instance.shipping_method),
            tracking_number=serializer.validated_data.get("tracking_number", serializer.instance.tracking_number),
            waybill_number=serializer.validated_data.get("waybill_number", serializer.instance.waybill_number),
            waybill_printed=serializer.validated_data.get("waybill_printed", serializer.instance.waybill_printed),
            deliverer_name=serializer.validated_data.get("deliverer_name", serializer.instance.deliverer_name),
            deliverer_phone=serializer.validated_data.get("deliverer_phone", serializer.instance.deliverer_phone),
            receiver_name=serializer.validated_data.get("receiver_name", serializer.instance.receiver_name),
            receiver_phone=serializer.validated_data.get("receiver_phone", serializer.instance.receiver_phone),
            receiver_country=serializer.validated_data.get("receiver_country", serializer.instance.receiver_country),
            receiver_state=serializer.validated_data.get("receiver_state", serializer.instance.receiver_state),
            receiver_city=serializer.validated_data.get("receiver_city", serializer.instance.receiver_city),
            receiver_address=serializer.validated_data.get("receiver_address", serializer.instance.receiver_address),
            receiver_postal_code=serializer.validated_data.get("receiver_postal_code", serializer.instance.receiver_postal_code),
            packed_at=serializer.validated_data.get("packed_at", serializer.instance.packed_at),
            exception_state=serializer.validated_data.get("exception_state", serializer.instance.exception_state),
            exception_notes=serializer.validated_data.get("exception_notes", serializer.instance.exception_notes),
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

    def report_short_pick(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        pick_task = self.get_object()
        self.check_object_permissions(request, pick_task)
        serializer = PickTaskShortPickReportSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        short_pick = report_short_pick(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            pick_task=pick_task,
            payload=ShortPickReportPayload(**serializer.validated_data),
        )
        return Response(ShortPickRecordSerializer(short_pick).data, status=status.HTTP_201_CREATED)


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


class OutboundWaveViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = OutboundWave.objects.select_related("warehouse").prefetch_related("orders", "orders__sales_order")
    serializer_class = OutboundWaveSerializer
    filterset_class = OutboundWaveFilter
    ordering_fields = ["generated_at", "create_time"]
    search_fields = ["wave_number", "notes", "generated_by"]

    def perform_create(self, serializer: OutboundWaveSerializer) -> None:
        operator = get_request_operator(self.request)
        wave = create_outbound_wave(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            wave_number=serializer.validated_data["wave_number"],
            sales_orders=serializer.validated_data.get("sales_order_ids", []),
            notes=serializer.validated_data.get("notes", ""),
        )
        serializer.instance = wave

    def perform_update(self, serializer: OutboundWaveSerializer) -> None:
        wave = update_outbound_wave(
            openid=self._current_openid(),
            wave=serializer.instance,
            payload=WaveUpdatePayload(
                status=serializer.validated_data.get("status", serializer.instance.status),
                notes=serializer.validated_data.get("notes", serializer.instance.notes),
            ),
        )
        serializer.instance = wave


class PackageExecutionRecordViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = PackageExecutionRecord.objects.select_related("warehouse", "sales_order", "shipment", "wave")
    serializer_class = PackageExecutionRecordSerializer
    filterset_class = PackageExecutionRecordFilter
    ordering_fields = ["executed_at", "create_time"]
    search_fields = ["record_number", "package_number", "scan_code", "sales_order__order_number"]

    def perform_create(self, serializer: PackageExecutionRecordSerializer) -> None:
        operator = get_request_operator(self.request)
        record = record_package_execution(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            sales_order=serializer.validated_data["sales_order"],
            payload=PackageExecutionPayload(
                shipment=serializer.validated_data.get("shipment"),
                wave=serializer.validated_data.get("wave"),
                record_number=serializer.validated_data["record_number"],
                step_type=serializer.validated_data["step_type"],
                execution_status=serializer.validated_data.get("execution_status", "SUCCESS"),
                package_number=serializer.validated_data["package_number"],
                scan_code=serializer.validated_data.get("scan_code", ""),
                weight=serializer.validated_data.get("weight"),
                notes=serializer.validated_data.get("notes", ""),
                requested_order_type=serializer.validated_data.get("requested_order_type", ""),
            ),
        )
        serializer.instance = record


class ShipmentDocumentRecordViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = ShipmentDocumentRecord.objects.select_related("warehouse", "sales_order", "shipment", "wave")
    serializer_class = ShipmentDocumentRecordSerializer
    filterset_class = ShipmentDocumentRecordFilter
    ordering_fields = ["generated_at", "create_time"]
    search_fields = ["document_number", "reference_code", "file_name", "sales_order__order_number"]

    def perform_create(self, serializer: ShipmentDocumentRecordSerializer) -> None:
        operator = get_request_operator(self.request)
        record = create_shipment_document(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            sales_order=serializer.validated_data["sales_order"],
            payload=ShipmentDocumentPayload(
                shipment=serializer.validated_data.get("shipment"),
                wave=serializer.validated_data.get("wave"),
                document_number=serializer.validated_data["document_number"],
                document_type=serializer.validated_data["document_type"],
                reference_code=serializer.validated_data.get("reference_code", ""),
                file_name=serializer.validated_data.get("file_name", ""),
                notes=serializer.validated_data.get("notes", ""),
            ),
        )
        serializer.instance = record


class LogisticsTrackingEventViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = LogisticsTrackingEvent.objects.select_related("warehouse", "sales_order", "shipment")
    serializer_class = LogisticsTrackingEventSerializer
    filterset_class = LogisticsTrackingEventFilter
    ordering_fields = ["occurred_at", "create_time"]
    search_fields = ["event_number", "tracking_number", "event_code", "description", "sales_order__order_number"]

    def perform_create(self, serializer: LogisticsTrackingEventSerializer) -> None:
        operator = get_request_operator(self.request)
        event = record_logistics_tracking_event(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            sales_order=serializer.validated_data["sales_order"],
            payload=LogisticsTrackingPayload(
                shipment=serializer.validated_data.get("shipment"),
                event_number=serializer.validated_data["event_number"],
                tracking_number=serializer.validated_data.get("tracking_number", ""),
                event_code=serializer.validated_data["event_code"],
                event_status=serializer.validated_data["event_status"],
                event_location=serializer.validated_data.get("event_location", ""),
                description=serializer.validated_data.get("description", ""),
                occurred_at=serializer.validated_data.get("occurred_at"),
            ),
        )
        serializer.instance = event


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


class ShortPickRecordViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = ShortPickRecord.objects.select_related(
        "warehouse",
        "sales_order",
        "sales_order_line",
        "pick_task",
        "goods",
        "from_location",
        "to_location",
    )
    serializer_class = ShortPickRecordSerializer
    filterset_class = ShortPickRecordFilter
    ordering_fields = ["reported_at", "resolved_at", "create_time"]
    search_fields = ["sales_order__order_number", "goods__goods_code", "pick_task__task_number", "reported_by", "resolved_by"]

    def resolve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        record = self.get_object()
        self.check_object_permissions(request, record)
        serializer = ShortPickResolveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        record = resolve_short_pick_record(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            short_pick_record=record,
            payload=ShortPickResolvePayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(record).data, status=status.HTTP_200_OK)
