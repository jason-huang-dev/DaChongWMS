"""Warehouse API viewsets."""

# cSpell:ignore viewsets filterset

from __future__ import annotations

from typing import Any, Sequence, Type, cast

from django.db.models import QuerySet
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.serializers import ModelSerializer

from utils.page import MyPageNumberPagination

from .filter import WarehouseFilter
from .models import Warehouse
from .serializers import (
    WarehouseGetSerializer,
    WarehousePartialUpdateSerializer,
    WarehousePostSerializer,
    WarehouseUpdateSerializer,
)


FilterBackend = Type[Any]


class WarehouseViewSet(viewsets.ModelViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[FilterBackend] = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    filterset_class = WarehouseFilter

    def get_queryset(self) -> QuerySet[Warehouse]:
        pk = cast(str | None, self.kwargs.get("pk"))
        base: QuerySet[Warehouse] = Warehouse.objects.filter(openid=getattr(self.request.auth, "openid", None), is_delete=False)
        if pk is not None:
            return base.filter(id=pk)
        return base

    def get_serializer_class(self) -> Type[ModelSerializer]:
        if self.action in ["list", "retrieve", "destroy"]:
            return WarehouseGetSerializer
        if self.action == "create":
            return WarehousePostSerializer
        if self.action == "update":
            return WarehouseUpdateSerializer
        if self.action == "partial_update":
            return WarehousePartialUpdateSerializer
        return WarehouseGetSerializer

    def perform_create(self, serializer: WarehousePostSerializer) -> None:
        openid = getattr(self.request.auth, "openid", None)
        warehouse_name = serializer.validated_data.get("warehouse_name")
        if isinstance(warehouse_name, str) and len(warehouse_name) > 45:
            raise APIException({"detail": "Warehouse name cannot exceed 45 characters"})
        if Warehouse.objects.filter(openid=openid, is_delete=False).count() >= 1:
            raise APIException({"detail": "Only one warehouse is allowed in this tier"})
        serializer.save(openid=openid)

    def perform_update(self, serializer: WarehouseUpdateSerializer) -> None:
        warehouse_name = serializer.validated_data.get("warehouse_name")
        if isinstance(warehouse_name, str) and len(warehouse_name) > 45:
            raise APIException({"detail": "Warehouse name cannot exceed 45 characters"})
        serializer.save()

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        instance.is_delete = True
        instance.save(update_fields=["is_delete", "update_time"])
        serializer = WarehouseGetSerializer(instance)
        return Response(serializer.data)


class WarehouseMultipleViewSet(viewsets.ReadOnlyModelViewSet):
    authentication_classes: Sequence[Any] = []
    permission_classes: Sequence[Any] = []
    throttle_classes: Sequence[Any] = []
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[FilterBackend] = [DjangoFilterBackend, OrderingFilter]
    ordering_fields = ["-id"]
    filterset_class = WarehouseFilter
    queryset: QuerySet[Warehouse] = Warehouse.objects.filter(is_delete=False)
    serializer_class = WarehouseGetSerializer
