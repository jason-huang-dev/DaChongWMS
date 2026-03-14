"""Transfer and replenishment API viewsets."""

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

from .filter import ReplenishmentRuleFilter, ReplenishmentTaskFilter, TransferLineFilter, TransferOrderFilter
from .models import ReplenishmentRule, ReplenishmentTask, TransferLine, TransferOrder
from .permissions import CanManageTransferRecords
from .serializers import (
    ReplenishmentGenerateSerializer,
    ReplenishmentRuleSerializer,
    ReplenishmentTaskCompleteSerializer,
    ReplenishmentTaskSerializer,
    TransferLineCompleteSerializer,
    TransferLineSerializer,
    TransferOrderSerializer,
)
from .services import (
    ReplenishmentGeneratePayload,
    ReplenishmentTaskUpdatePayload,
    TransferLinePayload,
    TransferLineUpdatePayload,
    archive_replenishment_rule,
    archive_transfer_order,
    complete_replenishment_task,
    complete_transfer_line,
    create_replenishment_rule,
    create_transfer_order,
    generate_replenishment_task,
    update_replenishment_rule,
    update_replenishment_task,
    update_transfer_line,
    update_transfer_order,
)
from inventory.models import InventoryStatus


class TenantScopedViewSet(viewsets.GenericViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageTransferRecords]
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


class TransferOrderViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = TransferOrder.objects.select_related("warehouse").prefetch_related("lines", "lines__goods", "lines__from_location", "lines__to_location")
    serializer_class = TransferOrderSerializer
    filterset_class = TransferOrderFilter
    search_fields = ["transfer_number", "reference_code", "notes"]

    def perform_create(self, serializer: TransferOrderSerializer) -> None:
        operator = get_request_operator(self.request)
        line_payloads = [TransferLinePayload(**item) for item in serializer.validated_data.pop("line_items")]
        transfer_order = create_transfer_order(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            transfer_number=serializer.validated_data["transfer_number"],
            requested_date=serializer.validated_data.get("requested_date"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
            line_items=line_payloads,
        )
        serializer.instance = transfer_order

    def perform_update(self, serializer: TransferOrderSerializer) -> None:
        transfer_order = update_transfer_order(
            openid=self._current_openid(),
            transfer_order=serializer.instance,
            requested_date=serializer.validated_data.get("requested_date", serializer.instance.requested_date),
            reference_code=serializer.validated_data.get("reference_code", serializer.instance.reference_code),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
            status=serializer.validated_data.get("status", serializer.instance.status),
        )
        serializer.instance = transfer_order

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        transfer_order = self.get_object()
        archive_transfer_order(openid=self._current_openid(), transfer_order=transfer_order)
        serializer = self.get_serializer(transfer_order)
        return Response(serializer.data)


class TransferLineViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = TransferLine.objects.select_related(
        "transfer_order",
        "transfer_order__warehouse",
        "goods",
        "from_location",
        "to_location",
        "assigned_to",
        "inventory_movement",
    )
    serializer_class = TransferLineSerializer
    filterset_class = TransferLineFilter
    search_fields = ["transfer_order__transfer_number", "goods__goods_code", "from_location__location_code", "to_location__location_code"]

    def perform_update(self, serializer: TransferLineSerializer) -> None:
        line = update_transfer_line(
            openid=self._current_openid(),
            transfer_line=serializer.instance,
            payload=TransferLineUpdatePayload(
                assigned_to=serializer.validated_data.get("assigned_to", serializer.instance.assigned_to),
                to_location=serializer.validated_data.get("to_location", serializer.instance.to_location),
                status=serializer.validated_data.get("status", serializer.instance.status),
                notes=serializer.validated_data.get("notes", serializer.instance.notes),
            ),
        )
        serializer.instance = line

    def complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        transfer_line = self.get_object()
        self.check_object_permissions(request, transfer_line)
        serializer = TransferLineCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        line = complete_transfer_line(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            transfer_line=transfer_line,
            to_location=serializer.validated_data.get("to_location"),
        )
        response_serializer = self.get_serializer(line)
        return Response(response_serializer.data, status=status.HTTP_200_OK)


class ReplenishmentRuleViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    mixins.DestroyModelMixin,
    TenantScopedViewSet,
):
    queryset = ReplenishmentRule.objects.select_related("warehouse", "goods", "source_location", "target_location")
    serializer_class = ReplenishmentRuleSerializer
    filterset_class = ReplenishmentRuleFilter
    search_fields = ["goods__goods_code", "source_location__location_code", "target_location__location_code", "notes"]

    def perform_create(self, serializer: ReplenishmentRuleSerializer) -> None:
        operator = get_request_operator(self.request)
        rule = create_replenishment_rule(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            goods=serializer.validated_data["goods"],
            source_location=serializer.validated_data["source_location"],
            target_location=serializer.validated_data["target_location"],
            minimum_qty=serializer.validated_data["minimum_qty"],
            target_qty=serializer.validated_data["target_qty"],
            stock_status=serializer.validated_data.get("stock_status", InventoryStatus.AVAILABLE),
            priority=serializer.validated_data.get("priority", 100),
            is_active=serializer.validated_data.get("is_active", True),
            notes=serializer.validated_data.get("notes", ""),
        )
        serializer.instance = rule

    def perform_update(self, serializer: ReplenishmentRuleSerializer) -> None:
        rule = update_replenishment_rule(
            openid=self._current_openid(),
            replenishment_rule=serializer.instance,
            warehouse=serializer.validated_data.get("warehouse", serializer.instance.warehouse),
            goods=serializer.validated_data.get("goods", serializer.instance.goods),
            source_location=serializer.validated_data.get("source_location", serializer.instance.source_location),
            target_location=serializer.validated_data.get("target_location", serializer.instance.target_location),
            minimum_qty=serializer.validated_data.get("minimum_qty", serializer.instance.minimum_qty),
            target_qty=serializer.validated_data.get("target_qty", serializer.instance.target_qty),
            stock_status=serializer.validated_data.get("stock_status", serializer.instance.stock_status),
            priority=serializer.validated_data.get("priority", serializer.instance.priority),
            is_active=serializer.validated_data.get("is_active", serializer.instance.is_active),
            notes=serializer.validated_data.get("notes", serializer.instance.notes),
        )
        serializer.instance = rule

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        rule = self.get_object()
        archive_replenishment_rule(openid=self._current_openid(), replenishment_rule=rule)
        serializer = self.get_serializer(rule)
        return Response(serializer.data)

    def generate_task(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        rule = self.get_object()
        self.check_object_permissions(request, rule)
        serializer = ReplenishmentGenerateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        task = generate_replenishment_task(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            replenishment_rule=rule,
            payload=ReplenishmentGeneratePayload(assigned_to=serializer.validated_data.get("assigned_to")),
        )
        response_serializer = ReplenishmentTaskSerializer(task)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)


class ReplenishmentTaskViewSet(
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    TenantScopedViewSet,
):
    queryset = ReplenishmentTask.objects.select_related(
        "replenishment_rule",
        "warehouse",
        "source_balance",
        "goods",
        "from_location",
        "to_location",
        "assigned_to",
        "inventory_movement",
    )
    serializer_class = ReplenishmentTaskSerializer
    filterset_class = ReplenishmentTaskFilter
    search_fields = ["task_number", "goods__goods_code", "from_location__location_code", "to_location__location_code"]

    def perform_update(self, serializer: ReplenishmentTaskSerializer) -> None:
        task = update_replenishment_task(
            openid=self._current_openid(),
            replenishment_task=serializer.instance,
            payload=ReplenishmentTaskUpdatePayload(
                assigned_to=serializer.validated_data.get("assigned_to", serializer.instance.assigned_to),
                to_location=serializer.validated_data.get("to_location", serializer.instance.to_location),
                status=serializer.validated_data.get("status", serializer.instance.status),
                notes=serializer.validated_data.get("notes", serializer.instance.notes),
            ),
        )
        serializer.instance = task

    def complete(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        task = self.get_object()
        self.check_object_permissions(request, task)
        serializer = ReplenishmentTaskCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        operator = get_request_operator(request)
        task = complete_replenishment_task(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            replenishment_task=task,
            to_location=serializer.validated_data.get("to_location"),
        )
        response_serializer = self.get_serializer(task)
        return Response(response_serializer.data, status=status.HTTP_200_OK)
