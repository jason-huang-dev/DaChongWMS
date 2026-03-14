"""API views for schedule configuration and worker task visibility."""

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

from .filter import AutomationAlertFilter, BackgroundTaskFilter, ScheduledTaskFilter, WorkerHeartbeatFilter
from .models import AutomationAlert, BackgroundTask, ScheduledTask, WorkerHeartbeat
from .permissions import CanManageAutomationRecords
from .serializers import (
    AutomationAlertSerializer,
    BackgroundTaskSerializer,
    ScheduledTaskSerializer,
    WorkerHeartbeatSerializer,
)
from .services import build_automation_dashboard, evaluate_automation_alerts, requeue_background_task, run_scheduled_task_now


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageAutomationRecords]
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


class ScheduledTaskViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = ScheduledTask.objects.select_related("warehouse", "customer")
    serializer_class = ScheduledTaskSerializer
    filterset_class = ScheduledTaskFilter
    search_fields = ["name", "task_type", "notes"]

    def perform_create(self, serializer: ScheduledTaskSerializer) -> None:
        operator = get_request_operator(self.request)
        serializer.save(creator=operator.staff_name, openid=self._current_openid())

    def perform_update(self, serializer: ScheduledTaskSerializer) -> None:
        serializer.save()

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        schedule = self.get_object()
        schedule.is_delete = True
        schedule.is_active = False
        schedule.save(update_fields=["is_delete", "is_active", "update_time"])
        return Response(self.get_serializer(schedule).data)

    def run_now(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        schedule = self.get_object()
        self.check_object_permissions(request, schedule)
        operator = get_request_operator(request)
        task = run_scheduled_task_now(openid=self._current_openid(), operator_name=operator.staff_name, scheduled_task=schedule)
        return Response(BackgroundTaskSerializer(task).data, status=status.HTTP_202_ACCEPTED)


class BackgroundTaskViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = BackgroundTask.objects.select_related("scheduled_task", "warehouse", "customer", "integration_job", "report_export", "invoice")
    serializer_class = BackgroundTaskSerializer
    filterset_class = BackgroundTaskFilter
    ordering_fields = ["id", "available_at", "started_at", "completed_at", "create_time"]
    search_fields = ["reference_code", "task_type", "locked_by", "last_error"]

    def retry(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        task = self.get_object()
        self.check_object_permissions(request, task)
        operator = get_request_operator(request)
        task = requeue_background_task(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            task=task,
        )
        return Response(self.get_serializer(task).data, status=status.HTTP_202_ACCEPTED)

    def dashboard(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        payload = build_automation_dashboard(openid=self._current_openid())
        return Response(payload, status=status.HTTP_200_OK)

    def evaluate_alerts(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        operator = get_request_operator(request)
        payload = evaluate_automation_alerts(operator_name=operator.staff_name)
        return Response(payload, status=status.HTTP_200_OK)


class WorkerHeartbeatViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    permission_classes = [CanManageAutomationRecords]
    queryset = WorkerHeartbeat.objects.all()
    serializer_class = WorkerHeartbeatSerializer
    filterset_class = WorkerHeartbeatFilter
    ordering_fields = ["worker_name", "last_seen_at", "update_time"]
    search_fields = ["worker_name", "last_error"]


class AutomationAlertViewSet(mixins.ListModelMixin, mixins.RetrieveModelMixin, TenantScopedViewSet):
    queryset = AutomationAlert.objects.select_related("warehouse", "scheduled_task", "background_task")
    serializer_class = AutomationAlertSerializer
    filterset_class = AutomationAlertFilter
    ordering_fields = ["opened_at", "resolved_at", "create_time"]
    search_fields = ["alert_key", "summary"]
