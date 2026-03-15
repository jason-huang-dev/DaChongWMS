"""Scanner APIs for handheld device sessions and offline replay."""

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

from .filter import HandheldDeviceSessionFilter, HandheldTelemetrySampleFilter, OfflineReplayBatchFilter
from .models import HandheldDeviceSession, HandheldTelemetrySample, OfflineReplayBatch
from .permissions import CanUseScannerWorkflow
from .serializers import (
    HandheldDeviceSessionSerializer,
    HandheldSessionEndSerializer,
    HandheldSessionHeartbeatSerializer,
    HandheldTelemetrySampleCreateSerializer,
    HandheldTelemetrySampleSerializer,
    OfflineReplayBatchCreateSerializer,
    OfflineReplayBatchSerializer,
)
from .services import (
    DeviceSessionHeartbeatPayload,
    DeviceSessionPayload,
    HandheldTelemetryPayload,
    OfflineReplayBatchPayload,
    OfflineReplayEventPayload,
    end_handheld_device_session,
    heartbeat_handheld_device_session,
    record_handheld_telemetry_sample,
    replay_offline_batch,
    start_handheld_device_session,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanUseScannerWorkflow]
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


class HandheldDeviceSessionViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = HandheldDeviceSession.objects.select_related("operator")
    serializer_class = HandheldDeviceSessionSerializer
    filterset_class = HandheldDeviceSessionFilter
    ordering_fields = ["id", "session_started_at", "last_seen_at", "create_time"]
    search_fields = ["device_id", "device_label", "platform", "app_version", "notes"]

    def perform_create(self, serializer: HandheldDeviceSessionSerializer) -> None:
        operator = get_request_operator(self.request)
        session = start_handheld_device_session(
            openid=self._current_openid(),
            operator=operator,
            payload=DeviceSessionPayload(
                device_id=serializer.validated_data["device_id"],
                device_label=serializer.validated_data.get("device_label", ""),
                app_version=serializer.validated_data.get("app_version", ""),
                platform=serializer.validated_data.get("platform", ""),
                notes=serializer.validated_data.get("notes", ""),
                metadata=serializer.validated_data.get("metadata", {}),
            ),
        )
        serializer.instance = session

    def heartbeat(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        session = self.get_object()
        self.check_object_permissions(request, session)
        serializer = HandheldSessionHeartbeatSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        session = heartbeat_handheld_device_session(
            openid=self._current_openid(),
            operator=operator,
            session=session,
            payload=DeviceSessionHeartbeatPayload(
                app_version=serializer.validated_data.get("app_version", ""),
                notes=serializer.validated_data.get("notes", ""),
                metadata=serializer.validated_data.get("metadata", {}),
            ),
        )
        return Response(self.get_serializer(session).data, status=status.HTTP_200_OK)

    def end(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        session = self.get_object()
        self.check_object_permissions(request, session)
        serializer = HandheldSessionEndSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        session = end_handheld_device_session(
            openid=self._current_openid(),
            operator=operator,
            session=session,
            notes=serializer.validated_data.get("notes", ""),
        )
        return Response(self.get_serializer(session).data, status=status.HTTP_200_OK)


class OfflineReplayBatchViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = OfflineReplayBatch.objects.select_related("session", "operator").prefetch_related("events")
    serializer_class = OfflineReplayBatchSerializer
    filterset_class = OfflineReplayBatchFilter
    ordering_fields = ["id", "submitted_at", "processed_at", "create_time"]
    search_fields = ["client_batch_id", "last_error", "notes", "session__device_id"]

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        create_serializer = OfflineReplayBatchCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        existing_batch = OfflineReplayBatch.objects.filter(
            openid=self._current_openid(),
            session=create_serializer.validated_data["session"],
            client_batch_id=create_serializer.validated_data["client_batch_id"],
            is_delete=False,
        ).first()
        batch = replay_offline_batch(
            openid=self._current_openid(),
            operator=operator,
            payload=OfflineReplayBatchPayload(
                session=create_serializer.validated_data["session"],
                client_batch_id=create_serializer.validated_data["client_batch_id"],
                notes=create_serializer.validated_data.get("notes", ""),
                events=[
                    OfflineReplayEventPayload(
                        sequence_number=item["sequence_number"],
                        event_type=item["event_type"],
                        payload=item["payload"],
                        notes=item.get("notes", ""),
                    )
                    for item in create_serializer.validated_data["events"]
                ],
            ),
        )
        serializer = self.get_serializer(batch)
        status_code = status.HTTP_200_OK if existing_batch is not None else status.HTTP_201_CREATED
        return Response(serializer.data, status=status_code)


class HandheldTelemetrySampleViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = HandheldTelemetrySample.objects.select_related("session", "operator")
    serializer_class = HandheldTelemetrySampleSerializer
    filterset_class = HandheldTelemetrySampleFilter
    ordering_fields = ["id", "recorded_at", "create_time"]
    search_fields = ["session__device_id", "operator__staff_name", "network_type"]

    def create(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        create_serializer = HandheldTelemetrySampleCreateSerializer(data=request.data)
        create_serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        sample = record_handheld_telemetry_sample(
            openid=self._current_openid(),
            operator=operator,
            session=create_serializer.validated_data["session"],
            payload=HandheldTelemetryPayload(
                scan_count=create_serializer.validated_data.get("scan_count", 0),
                queued_event_count=create_serializer.validated_data.get("queued_event_count", 0),
                sync_count=create_serializer.validated_data.get("sync_count", 0),
                replay_conflict_count=create_serializer.validated_data.get("replay_conflict_count", 0),
                replay_failure_count=create_serializer.validated_data.get("replay_failure_count", 0),
                battery_level=create_serializer.validated_data.get("battery_level"),
                network_type=create_serializer.validated_data.get("network_type", ""),
                signal_strength=create_serializer.validated_data.get("signal_strength"),
                latency_ms=create_serializer.validated_data.get("latency_ms"),
                storage_free_mb=create_serializer.validated_data.get("storage_free_mb"),
                metadata=create_serializer.validated_data.get("metadata", {}),
            ),
        )
        serializer = self.get_serializer(sample)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
