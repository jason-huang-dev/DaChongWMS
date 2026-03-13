"""Inventory API viewsets."""

from __future__ import annotations

from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import mixins, viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.operator import get_request_operator
from utils.page import MyPageNumberPagination

from .filter import InventoryBalanceFilter, InventoryHoldFilter, InventoryMovementFilter
from .models import InventoryBalance, InventoryHold, InventoryMovement
from .permissions import CanManageInventoryRecords
from .serializers import InventoryBalanceSerializer, InventoryHoldSerializer, InventoryMovementSerializer
from .services import create_inventory_hold, ensure_tenant_match, record_inventory_movement, release_inventory_hold


class TenantScopedReadOnlyViewSet(viewsets.ReadOnlyModelViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    permission_classes = [CanManageInventoryRecords]
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


class InventoryBalanceViewSet(TenantScopedReadOnlyViewSet):
    queryset = InventoryBalance.objects.select_related("warehouse", "location", "goods")
    serializer_class = InventoryBalanceSerializer
    filterset_class = InventoryBalanceFilter
    search_fields = ["goods__goods_code", "location__location_code", "lot_number", "serial_number"]


class InventoryMovementViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    viewsets.GenericViewSet,
):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "occurred_at", "create_time"]
    search_fields = ["goods__goods_code", "reference_code", "reason", "performed_by"]
    permission_classes = [CanManageInventoryRecords]
    queryset = InventoryMovement.objects.select_related("warehouse", "goods", "from_location", "to_location")
    serializer_class = InventoryMovementSerializer
    filterset_class = InventoryMovementFilter

    def get_queryset(self):
        openid = getattr(self.request.auth, "openid", None)
        queryset = self.queryset.filter(openid=openid, is_delete=False)
        pk = self.kwargs.get("pk")
        if pk is not None:
            return queryset.filter(pk=pk)
        return queryset

    def perform_create(self, serializer: InventoryMovementSerializer) -> None:
        operator = get_request_operator(self.request)
        movement = record_inventory_movement(
            openid=getattr(self.request.auth, "openid", ""),
            operator_name=operator.staff_name,
            warehouse=serializer.validated_data["warehouse"],
            goods=serializer.validated_data["goods"],
            movement_type=serializer.validated_data["movement_type"],
            quantity=serializer.validated_data["quantity"],
            stock_status=serializer.validated_data.get("stock_status", "AVAILABLE"),
            lot_number=serializer.validated_data.get("lot_number", ""),
            serial_number=serializer.validated_data.get("serial_number", ""),
            unit_cost=serializer.validated_data.get("unit_cost", 0),
            from_location=serializer.validated_data.get("from_location"),
            to_location=serializer.validated_data.get("to_location"),
            reference_code=serializer.validated_data.get("reference_code", ""),
            reason=serializer.validated_data.get("reason", ""),
        )
        serializer.instance = movement


class InventoryHoldViewSet(viewsets.ModelViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields = ["inventory_balance__goods__goods_code", "reason", "reference_code", "held_by"]
    permission_classes = [CanManageInventoryRecords]
    queryset = InventoryHold.objects.select_related("inventory_balance", "inventory_balance__goods", "inventory_balance__location")
    serializer_class = InventoryHoldSerializer
    filterset_class = InventoryHoldFilter

    def get_queryset(self):
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

    def perform_create(self, serializer: InventoryHoldSerializer) -> None:
        operator = get_request_operator(self.request)
        hold = create_inventory_hold(
            openid=self._current_openid(),
            operator_name=operator.staff_name,
            inventory_balance=serializer.validated_data["inventory_balance"],
            quantity=serializer.validated_data["quantity"],
            reason=serializer.validated_data["reason"],
            reference_code=serializer.validated_data.get("reference_code", ""),
            notes=serializer.validated_data.get("notes", ""),
        )
        serializer.instance = hold

    def perform_update(self, serializer: InventoryHoldSerializer) -> None:
        operator = get_request_operator(self.request)
        instance = serializer.instance
        ensure_tenant_match(instance, self._current_openid(), "Inventory hold")
        if "inventory_balance" in serializer.validated_data and serializer.validated_data["inventory_balance"] != instance.inventory_balance:
            raise APIException({"detail": "Inventory balance cannot be changed once the hold is created"})
        if "quantity" in serializer.validated_data and serializer.validated_data["quantity"] != instance.quantity:
            raise APIException({"detail": "Quantity changes require creating a new hold"})
        next_active = serializer.validated_data.get("is_active", instance.is_active)
        if not instance.is_active and next_active:
            raise APIException({"detail": "Released holds cannot be reactivated"})
        if instance.is_active and not next_active:
            hold = release_inventory_hold(
                openid=self._current_openid(),
                operator_name=operator.staff_name,
                hold=instance,
            )
            hold.reason = serializer.validated_data.get("reason", hold.reason)
            hold.reference_code = serializer.validated_data.get("reference_code", hold.reference_code)
            hold.notes = serializer.validated_data.get("notes", hold.notes)
            hold.save(update_fields=["reason", "reference_code", "notes", "update_time"])
            serializer.instance = hold
            return
        serializer.save(
            creator=instance.creator,
            held_by=instance.held_by,
            released_by=instance.released_by,
            released_at=instance.released_at,
        )

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        if instance.is_active:
            operator = get_request_operator(request)
            release_inventory_hold(
                openid=self._current_openid(),
                operator_name=operator.staff_name,
                hold=instance,
            )
            instance.refresh_from_db()
        instance.is_delete = True
        instance.save(update_fields=["is_delete", "update_time"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)
