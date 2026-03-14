"""Counting API viewsets."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Sequence

from django.db.models import Q
from django.http import StreamingHttpResponse
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, status, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from .files import DashboardFileRenderCN, DashboardFileRenderEN
from .filter import CountApprovalFilter, CycleCountFilter, CycleCountLineFilter
from .models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLine
from .permissions import CanManageCountingApprovals, CanManageCountingRecords
from .serializers import (
    CountApprovalDecisionSerializer,
    CountApprovalSerializer,
    CycleCountLineAssignSerializer,
    CycleCountLineScannerCompleteSerializer,
    CycleCountLineScanCountSerializer,
    CycleCountLineScanLookupSerializer,
    CycleCountLineSerializer,
    CycleCountSerializer,
)
from .services import (
    ApprovalDecisionPayload,
    AssignmentPayload,
    CycleCountLinePayload,
    CycleCountLineUpdatePayload,
    approve_count_approval,
    assign_cycle_count_line,
    build_approval_summary,
    build_supervisor_dashboard_export_rows,
    build_supervisor_dashboard,
    complete_scanner_task,
    create_cycle_count,
    find_cycle_count_line_by_scan,
    get_next_assigned_cycle_count_line,
    reject_count_approval,
    ScanLookupPayload,
    transition_scanner_task,
    submit_cycle_count,
    update_cycle_count_line,
)


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageCountingRecords]
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


class CycleCountViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    queryset = CycleCount.objects.select_related("warehouse").prefetch_related(
        "lines",
        "lines__location",
        "lines__goods",
        "lines__assigned_to",
        "lines__adjustment_reason",
        "lines__approval",
        "lines__recount_assigned_to",
    )
    serializer_class = CycleCountSerializer
    filterset_class = CycleCountFilter
    search_fields = ["count_number", "notes", "submitted_by"]

    def perform_create(self, serializer: CycleCountSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [CycleCountLinePayload(**item) for item in serializer.validated_data.pop("line_items")]
        cycle_count = create_cycle_count(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            count_number=serializer.validated_data["count_number"],
            scheduled_date=serializer.validated_data.get("scheduled_date"),
            is_blind_count=serializer.validated_data.get("is_blind_count", False),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = cycle_count

    def submit(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        cycle_count = self.get_object()
        self.check_object_permissions(request, cycle_count)
        operator = get_request_operator(request)
        cycle_count = submit_cycle_count(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            cycle_count=cycle_count,
        )
        serializer = self.get_serializer(cycle_count)
        return Response(serializer.data, status=status.HTTP_200_OK)


class CycleCountLineViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = CycleCountLine.objects.select_related(
        "cycle_count",
        "inventory_balance",
        "location",
        "goods",
        "adjustment_reason",
        "adjustment_movement",
        "assigned_to",
        "approval",
        "approval__approval_rule",
        "recount_assigned_to",
    )
    serializer_class = CycleCountLineSerializer
    filterset_class = CycleCountLineFilter
    search_fields = ["cycle_count__count_number", "location__location_code", "goods__goods_code", "lot_number", "serial_number"]

    def perform_update(self, serializer: CycleCountLineSerializer) -> None:
        operator = get_request_operator(self.request)
        line = update_cycle_count_line(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=serializer.instance,
            payload=CycleCountLineUpdatePayload(
                counted_qty=serializer.validated_data.get("counted_qty", serializer.instance.counted_qty),
                adjustment_reason=serializer.validated_data.get("adjustment_reason", serializer.instance.adjustment_reason),
                notes=serializer.validated_data.get("notes", serializer.instance.notes),
            ),
        )
        serializer.instance = line

    def assign(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        serializer = CycleCountLineAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = assign_cycle_count_line(
            openid=self._current_openid(),
            cycle_count_line=line,
            payload=AssignmentPayload(assigned_to=serializer.validated_data.get("assigned_to")),
        )
        response_serializer = self.get_serializer(line)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def assign_recount(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        serializer = CycleCountLineAssignSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        line = assign_cycle_count_line(
            openid=self._current_openid(),
            cycle_count_line=line,
            payload=AssignmentPayload(assigned_to=serializer.validated_data.get("assigned_to")),
            recount=True,
        )
        response_serializer = self.get_serializer(line)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def recount(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        serializer = self.get_serializer(line, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        line = update_cycle_count_line(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=line,
            payload=CycleCountLineUpdatePayload(
                counted_qty=serializer.validated_data.get("counted_qty", line.counted_qty),
                adjustment_reason=serializer.validated_data.get("adjustment_reason", line.adjustment_reason),
                notes=serializer.validated_data.get("notes", line.notes),
            ),
            recount=True,
        )
        response_serializer = self.get_serializer(line)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def my_assignments(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        operator = get_request_operator(request)
        queryset = self.filter_queryset(
            self.get_queryset().filter(
                (
                    Q(assigned_to=operator) & Q(status__in=["OPEN", "COUNTED"])
                )
                | Q(recount_assigned_to=operator, status="RECOUNT_ASSIGNED")
            )
        )
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True, context={**self.get_serializer_context(), "hide_system_qty": True})
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def next_task(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        operator = get_request_operator(request)
        line, task_type = get_next_assigned_cycle_count_line(
            openid=self._current_openid(),
            operator=operator,
        )
        if line is None or task_type is None:
            return Response(status=status.HTTP_204_NO_CONTENT)
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        payload = dict(response_serializer.data)
        payload["task_type"] = task_type
        return Response(payload, status=status.HTTP_200_OK)

    def scanner_ack(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        operator = get_request_operator(request)
        line = transition_scanner_task(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=line,
            action="ack",
        )
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scanner_start(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        operator = get_request_operator(request)
        line = transition_scanner_task(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=line,
            action="start",
        )
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scanner_complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        line = self.get_object()
        self.check_object_permissions(request, line)
        serializer = CycleCountLineScannerCompleteSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        line = complete_scanner_task(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=line,
            payload=CycleCountLineUpdatePayload(
                counted_qty=serializer.validated_data["counted_qty"],
                adjustment_reason=serializer.validated_data.get("adjustment_reason"),
                notes=serializer.validated_data.get("notes", line.notes),
            ),
        )
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scan_lookup(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = CycleCountLineScanLookupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        line = find_cycle_count_line_by_scan(
            openid=self._current_openid(),
            operator=operator,
            payload=ScanLookupPayload(
                location=serializer.validated_data["location"],
                sku=serializer.validated_data["sku"],
                count_number=serializer.validated_data.get("count_number", ""),
                recount=serializer.validated_data.get("recount", False),
            ),
        )
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def scan_count(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        serializer = CycleCountLineScanCountSerializer(data=request.data, context=self.get_serializer_context())
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        recount = serializer.validated_data.get("recount", False)
        line = find_cycle_count_line_by_scan(
            openid=self._current_openid(),
            operator=operator,
            payload=ScanLookupPayload(
                location=serializer.validated_data["location"],
                sku=serializer.validated_data["sku"],
                count_number=serializer.validated_data.get("count_number", ""),
                recount=recount,
            ),
        )
        line = update_cycle_count_line(
            openid=self._current_openid(),
            operator=operator,
            cycle_count_line=line,
            payload=CycleCountLineUpdatePayload(
                counted_qty=serializer.validated_data["counted_qty"],
                adjustment_reason=serializer.validated_data.get("adjustment_reason"),
                notes=serializer.validated_data.get("notes", line.notes),
            ),
            recount=recount,
        )
        response_serializer = self.get_serializer(line, context={**self.get_serializer_context(), "hide_system_qty": True})
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class CountApprovalViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    TenantScopedViewSet,
):
    permission_classes = [CanManageCountingApprovals]
    queryset = CountApproval.objects.select_related(
        "cycle_count_line",
        "cycle_count_line__cycle_count",
        "cycle_count_line__adjustment_reason",
        "cycle_count_line__location",
        "cycle_count_line__goods",
        "cycle_count_line__cycle_count__warehouse",
        "approval_rule",
    )
    serializer_class = CountApprovalSerializer
    filterset_class = CountApprovalFilter
    ordering_fields = ["id", "requested_at", "approved_at", "rejected_at", "create_time"]
    search_fields = ["cycle_count_line__cycle_count__count_number", "requested_by", "approved_by", "rejected_by"]

    def queue(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        status_values = request.query_params.get("status")
        if status_values:
            statuses = [value.strip() for value in status_values.split(",") if value.strip()]
        else:
            statuses = [CountApprovalStatus.PENDING, CountApprovalStatus.REJECTED]
        queryset = self.filter_queryset(self.get_queryset().filter(status__in=statuses))
        page = self.paginate_queryset(queryset)
        serializer = self.get_serializer(page or queryset, many=True)
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def summary(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        payload = build_approval_summary(openid=self._current_openid())
        return Response(payload, status=status.HTTP_200_OK)

    def dashboard(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        pending_sla_hours = self._parse_positive_int(request, "pending_sla_hours", default=24)
        recount_sla_hours = self._parse_positive_int(request, "recount_sla_hours", default=8)
        limit = self._parse_positive_int(request, "limit", default=10)
        payload = build_supervisor_dashboard(
            openid=self._current_openid(),
            pending_sla_hours=pending_sla_hours,
            recount_sla_hours=recount_sla_hours,
            limit=limit,
            warehouse_id=self._parse_optional_positive_int(request, "warehouse"),
            approver_role=self._parse_optional_string(request, "approver_role"),
        )
        return Response(payload, status=status.HTTP_200_OK)

    def dashboard_export(self, request: Request, *args: Any, **kwargs: Any) -> StreamingHttpResponse:
        pending_sla_hours = self._parse_positive_int(request, "pending_sla_hours", default=24)
        recount_sla_hours = self._parse_positive_int(request, "recount_sla_hours", default=8)
        rows = build_supervisor_dashboard_export_rows(
            openid=self._current_openid(),
            pending_sla_hours=pending_sla_hours,
            recount_sla_hours=recount_sla_hours,
            scope=request.query_params.get("scope", "all"),
            warehouse_id=self._parse_optional_positive_int(request, "warehouse"),
            approver_role=self._parse_optional_string(request, "approver_role"),
        )
        renderer = self._select_export_renderer(request.META.get("HTTP_LANGUAGE"))
        response = StreamingHttpResponse(
            renderer.render(rows),
            content_type="text/csv",
        )
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        response["Content-Disposition"] = f"attachment; filename='counting_dashboard_{timestamp}.csv'"
        return response

    @staticmethod
    def _parse_positive_int(request: Request, key: str, *, default: int) -> int:
        raw_value = request.query_params.get(key)
        if raw_value in {None, ""}:
            return default
        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise APIException({"detail": f"Query parameter `{key}` must be a positive integer"}) from exc
        if value <= 0:
            raise APIException({"detail": f"Query parameter `{key}` must be a positive integer"})
        return value

    @staticmethod
    def _parse_optional_positive_int(request: Request, key: str) -> int | None:
        raw_value = request.query_params.get(key)
        if raw_value in {None, ""}:
            return None
        try:
            value = int(raw_value)
        except (TypeError, ValueError) as exc:
            raise APIException({"detail": f"Query parameter `{key}` must be a positive integer"}) from exc
        if value <= 0:
            raise APIException({"detail": f"Query parameter `{key}` must be a positive integer"})
        return value

    @staticmethod
    def _parse_optional_string(request: Request, key: str) -> str | None:
        raw_value = request.query_params.get(key)
        if raw_value is None:
            return None
        value = raw_value.strip()
        return value or None

    @staticmethod
    def _select_export_renderer(language_header: str | None):
        if language_header and language_header.lower() == "zh-hans":
            return DashboardFileRenderCN()
        return DashboardFileRenderEN()

    def approve(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        approval = self.get_object()
        self.check_object_permissions(request, approval)
        serializer = CountApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        approval = approve_count_approval(
            openid=self._current_openid(),
            operator=operator,
            approval=approval,
            payload=ApprovalDecisionPayload(notes=serializer.validated_data.get("notes", "")),
        )
        response_serializer = self.get_serializer(approval)
        return Response(response_serializer.data, status=status.HTTP_200_OK)

    def reject(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        approval = self.get_object()
        self.check_object_permissions(request, approval)
        serializer = CountApprovalDecisionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        approval = reject_count_approval(
            openid=self._current_openid(),
            operator=operator,
            approval=approval,
            payload=ApprovalDecisionPayload(notes=serializer.validated_data.get("notes", "")),
        )
        response_serializer = self.get_serializer(approval)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
