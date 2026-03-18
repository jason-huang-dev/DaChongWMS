"""API viewsets for integrations."""

from __future__ import annotations

from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from .filter import CarrierBookingFilter, IntegrationJobFilter, IntegrationLogFilter, WebhookEventFilter
from .models import CarrierBooking, IntegrationJob, IntegrationLog, WebhookEvent
from .models import IntegrationSystemType
from .permissions import CanManageIntegrationRecords
from .serializers import (
    CarrierBookingSerializer,
    CarrierLabelSerializer,
    CarrierBookingCancelSerializer,
    CarrierBookingRetrySerializer,
    CarrierBookingRebookSerializer,
    IntegrationJobCompleteSerializer,
    IntegrationJobFailSerializer,
    IntegrationJobSerializer,
    IntegrationLogSerializer,
    WebhookEventSerializer,
    WebhookProcessSerializer,
)
from .services import (
    CarrierBookingPayload,
    CarrierLabelPayload,
    IntegrationJobCreatePayload,
    WebhookIntakePayload,
    complete_integration_job,
    create_carrier_booking,
    create_integration_job,
    fail_integration_job,
    generate_carrier_label,
    cancel_carrier_booking,
    rebook_carrier_booking,
    process_webhook_event,
    retry_carrier_booking,
    start_integration_job,
    intake_webhook,
    CarrierBookingRetryPayload,
    CarrierBookingRebookPayload,
    CarrierBookingCancelPayload,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageIntegrationRecords]
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


class IntegrationJobViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = IntegrationJob.objects.select_related("warehouse", "source_webhook")
    serializer_class = IntegrationJobSerializer
    filterset_class = IntegrationJobFilter
    search_fields = ["integration_name", "reference_code", "external_reference"]

    def perform_create(self, serializer: IntegrationJobSerializer) -> None:
        operator = get_request_operator(self.request)
        job = create_integration_job(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=IntegrationJobCreatePayload(
                warehouse=serializer.validated_data.get("warehouse"),
                source_webhook=serializer.validated_data.get("source_webhook"),
                system_type=serializer.validated_data["system_type"],
                integration_name=serializer.validated_data["integration_name"],
                job_type=serializer.validated_data["job_type"],
                direction=serializer.validated_data["direction"],
                reference_code=serializer.validated_data.get("reference_code", ""),
                external_reference=serializer.validated_data.get("external_reference", ""),
                request_payload=serializer.validated_data.get("request_payload", {}),
            ),
        )
        serializer.instance = job

    def start(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        job = self.get_object()
        self.check_object_permissions(request, job)
        operator = get_request_operator(request)
        job = start_integration_job(openid=self._current_openid(), operator_name=operator.staff_name, job=job)
        return Response(self.get_serializer(job).data)

    def complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        job = self.get_object()
        self.check_object_permissions(request, job)
        serializer = IntegrationJobCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        job = complete_integration_job(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            job=job,
            response_payload=serializer.validated_data.get("response_payload", {}),
        )
        return Response(self.get_serializer(job).data)

    def fail(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        job = self.get_object()
        self.check_object_permissions(request, job)
        serializer = IntegrationJobFailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        job = fail_integration_job(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            job=job,
            error_message=serializer.validated_data["error_message"],
            response_payload=serializer.validated_data.get("response_payload", {}),
        )
        return Response(self.get_serializer(job).data)


class WebhookEventViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = WebhookEvent.objects.select_related("warehouse")
    serializer_class = WebhookEventSerializer
    filterset_class = WebhookEventFilter
    ordering_fields = ["id", "received_at", "processed_at", "create_time"]
    search_fields = ["source_system", "event_type", "event_key", "reference_code"]

    def get_permissions(self):
        if self.action == "create":
            return [IsAuthenticated()]
        return super().get_permissions()

    def perform_create(self, serializer: WebhookEventSerializer) -> None:
        webhook_event = intake_webhook(
            openid=self._current_openid(),
            operator_name="system",
            payload=WebhookIntakePayload(
                warehouse=serializer.validated_data.get("warehouse"),
                system_type=serializer.validated_data.get("system_type") or IntegrationSystemType.WEBHOOK,
                source_system=serializer.validated_data["source_system"],
                event_type=serializer.validated_data["event_type"],
                event_key=serializer.validated_data["event_key"],
                signature=serializer.validated_data.get("signature", ""),
                headers=serializer.validated_data.get("headers", {}),
                payload=serializer.validated_data.get("payload", {}),
                reference_code=serializer.validated_data.get("reference_code", ""),
            ),
        )
        serializer.instance = webhook_event

    def process(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        webhook_event = self.get_object()
        self.check_object_permissions(request, webhook_event)
        serializer = WebhookProcessSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        webhook_event = process_webhook_event(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            webhook_event=webhook_event,
            response_payload=serializer.validated_data.get("response_payload", {}),
        )
        return Response(self.get_serializer(webhook_event).data)


class IntegrationLogViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = IntegrationLog.objects.select_related("job", "webhook_event")
    serializer_class = IntegrationLogSerializer
    filterset_class = IntegrationLogFilter
    ordering_fields = ["id", "logged_at", "create_time"]
    search_fields = ["message", "job__integration_name", "webhook_event__event_key"]


class CarrierBookingViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = CarrierBooking.objects.select_related("warehouse", "shipment", "booking_job", "label_job")
    serializer_class = CarrierBookingSerializer
    filterset_class = CarrierBookingFilter
    ordering_fields = ["id", "booked_at", "labeled_at", "create_time"]
    search_fields = ["booking_number", "carrier_code", "tracking_number", "external_reference"]

    def perform_create(self, serializer: CarrierBookingSerializer) -> None:
        operator = get_request_operator(self.request)
        booking = create_carrier_booking(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            payload=CarrierBookingPayload(
                warehouse=serializer.validated_data["warehouse"],
                shipment=serializer.validated_data.get("shipment"),
                booking_number=serializer.validated_data["booking_number"],
                carrier_code=serializer.validated_data["carrier_code"],
                service_level=serializer.validated_data.get("service_level", ""),
                package_count=serializer.validated_data.get("package_count", 1),
                total_weight=serializer.validated_data.get("total_weight"),
                external_reference=serializer.validated_data.get("external_reference", ""),
                request_payload=serializer.validated_data.get("request_payload", {}),
            ),
        )
        serializer.instance = booking

    def generate_label(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        booking = self.get_object()
        self.check_object_permissions(request, booking)
        serializer = CarrierLabelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        booking = generate_carrier_label(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            carrier_booking=booking,
            payload=CarrierLabelPayload(label_format=serializer.validated_data["label_format"]),
        )
        return Response(self.get_serializer(booking).data, status=status.HTTP_200_OK)

    def retry(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        booking = self.get_object()
        self.check_object_permissions(request, booking)
        serializer = CarrierBookingRetrySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        booking = retry_carrier_booking(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            carrier_booking=booking,
            payload=CarrierBookingRetryPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(booking).data, status=status.HTTP_202_ACCEPTED)

    def rebook(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        booking = self.get_object()
        self.check_object_permissions(request, booking)
        serializer = CarrierBookingRebookSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        booking = rebook_carrier_booking(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            carrier_booking=booking,
            payload=CarrierBookingRebookPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(booking).data, status=status.HTTP_202_ACCEPTED)

    def cancel(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        booking = self.get_object()
        self.check_object_permissions(request, booking)
        serializer = CarrierBookingCancelSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        booking = cancel_carrier_booking(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            carrier_booking=booking,
            payload=CarrierBookingCancelPayload(**serializer.validated_data),
        )
        return Response(self.get_serializer(booking).data, status=status.HTTP_200_OK)
