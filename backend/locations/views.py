"""Location topology API viewsets."""

from __future__ import annotations

from typing import Any, Sequence

from django_filters.rest_framework import DjangoFilterBackend
from rest_framework import viewsets
from rest_framework.exceptions import APIException
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.request import Request
from rest_framework.response import Response

from utils.page import MyPageNumberPagination
from utils.operator import get_request_operator

from .permissions import CanManageLocationLocks, CanManageLocationTopology
from .filter import LocationFilter, LocationLockFilter, LocationTypeFilter, ZoneFilter
from .models import Location, LocationLock, LocationStatus, LocationType, Zone
from .serializers import LocationLockSerializer, LocationSerializer, LocationTypeSerializer, ZoneSerializer


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    pagination_class = MyPageNumberPagination
    filter_backends: Sequence[type[Any]] = [DjangoFilterBackend, OrderingFilter, SearchFilter]
    ordering_fields = ["id", "create_time", "update_time"]
    search_fields: Sequence[str] = []
    queryset = None

    def get_queryset(self):  # type: ignore[override]
        assert self.queryset is not None
        openid = getattr(self.request.auth, "openid", None)
        queryset = self.queryset.filter(openid=openid, is_delete=False)
        pk = self.kwargs.get("pk")
        if pk is not None:
            return queryset.filter(pk=pk)
        return queryset

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        instance.is_delete = True
        instance.save(update_fields=["is_delete", "update_time"])
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

    def _current_openid(self) -> str:
        openid = getattr(self.request.auth, "openid", None)
        if not isinstance(openid, str) or not openid:
            raise APIException({"detail": "Authentication token missing openid"})
        return openid


class ZoneViewSet(TenantScopedModelViewSet):
    permission_classes = [CanManageLocationTopology]
    queryset = Zone.objects.select_related("warehouse")
    serializer_class = ZoneSerializer
    filterset_class = ZoneFilter
    search_fields = ["zone_code", "zone_name", "warehouse__warehouse_name"]

    def _validate_warehouse(self, warehouse: Any, openid: str) -> None:
        if warehouse.is_delete or warehouse.openid != openid:
            raise APIException({"detail": "Warehouse does not belong to the authenticated tenant"})

    def perform_create(self, serializer: ZoneSerializer) -> None:
        openid = self._current_openid()
        operator = get_request_operator(self.request)
        warehouse = serializer.validated_data["warehouse"]
        self._validate_warehouse(warehouse, openid)
        serializer.save(openid=openid, creator=operator.staff_name)

    def perform_update(self, serializer: ZoneSerializer) -> None:
        openid = self._current_openid()
        warehouse = serializer.validated_data.get("warehouse", serializer.instance.warehouse)
        self._validate_warehouse(warehouse, openid)
        serializer.save(creator=serializer.instance.creator)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        if Location.objects.filter(zone=instance, is_delete=False).exists():
            raise APIException({"detail": "Cannot archive a zone that still has active locations"})
        return super().destroy(request, *args, **kwargs)


class LocationTypeViewSet(TenantScopedModelViewSet):
    permission_classes = [CanManageLocationTopology]
    queryset = LocationType.objects.all()
    serializer_class = LocationTypeSerializer
    filterset_class = LocationTypeFilter
    search_fields = ["type_code", "type_name"]

    def perform_create(self, serializer: LocationTypeSerializer) -> None:
        operator = get_request_operator(self.request)
        serializer.save(openid=self._current_openid(), creator=operator.staff_name)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        if Location.objects.filter(location_type=instance, is_delete=False).exists():
            raise APIException({"detail": "Cannot archive a location type that is still in use"})
        return super().destroy(request, *args, **kwargs)


class LocationViewSet(TenantScopedModelViewSet):
    permission_classes = [CanManageLocationTopology]
    queryset = Location.objects.select_related("warehouse", "zone", "location_type")
    serializer_class = LocationSerializer
    filterset_class = LocationFilter
    search_fields = ["location_code", "location_name", "barcode"]

    def _validate_relations(self, serializer: LocationSerializer, openid: str) -> None:
        warehouse = serializer.validated_data.get("warehouse", serializer.instance.warehouse if serializer.instance else None)
        zone = serializer.validated_data.get("zone", serializer.instance.zone if serializer.instance else None)
        location_type = serializer.validated_data.get(
            "location_type",
            serializer.instance.location_type if serializer.instance else None,
        )
        if warehouse is None or zone is None or location_type is None:
            raise APIException({"detail": "Warehouse, zone, and location type are required"})
        if warehouse.is_delete or warehouse.openid != openid:
            raise APIException({"detail": "Warehouse does not belong to the authenticated tenant"})
        if zone.is_delete or zone.openid != openid:
            raise APIException({"detail": "Zone does not belong to the authenticated tenant"})
        if location_type.is_delete or location_type.openid != openid:
            raise APIException({"detail": "Location type does not belong to the authenticated tenant"})
        if zone.warehouse_id != warehouse.id:
            raise APIException({"detail": "Zone must belong to the selected warehouse"})

    def perform_create(self, serializer: LocationSerializer) -> None:
        openid = self._current_openid()
        operator = get_request_operator(self.request)
        self._validate_relations(serializer, openid)
        barcode = serializer.validated_data.get("barcode") or serializer.validated_data["location_code"]
        serializer.save(openid=openid, barcode=barcode, creator=operator.staff_name)

    def perform_update(self, serializer: LocationSerializer) -> None:
        openid = self._current_openid()
        self._validate_relations(serializer, openid)
        barcode = serializer.validated_data.get("barcode")
        if barcode == "":
            barcode = serializer.validated_data.get("location_code", serializer.instance.location_code)
        serializer.save(
            barcode=barcode if barcode is not None else serializer.instance.barcode,
            creator=serializer.instance.creator,
        )


class LocationLockViewSet(TenantScopedModelViewSet):
    permission_classes = [CanManageLocationLocks]
    queryset = LocationLock.objects.select_related("location")
    serializer_class = LocationLockSerializer
    filterset_class = LocationLockFilter
    search_fields = ["reason", "locked_by", "location__location_code"]

    def _validate_location(self, location: Location, openid: str) -> None:
        if location.is_delete or location.openid != openid:
            raise APIException({"detail": "Location does not belong to the authenticated tenant"})

    def _sync_location_lock_state(self, location: Location) -> None:
        has_active_lock = LocationLock.objects.filter(location=location, is_active=True, is_delete=False).exists()
        status = location.status
        if has_active_lock and location.status == LocationStatus.AVAILABLE:
            status = LocationStatus.BLOCKED
        if not has_active_lock and location.status == LocationStatus.BLOCKED:
            status = LocationStatus.AVAILABLE
        location.is_locked = has_active_lock
        location.status = status
        location.save(update_fields=["is_locked", "status", "update_time"])

    def perform_create(self, serializer: LocationLockSerializer) -> None:
        openid = self._current_openid()
        operator = get_request_operator(self.request)
        location = serializer.validated_data["location"]
        self._validate_location(location, openid)
        if serializer.validated_data.get("is_active", True) and LocationLock.objects.filter(
            location=location,
            is_active=True,
            is_delete=False,
        ).exists():
            raise APIException({"detail": "Location already has an active lock"})
        lock = serializer.save(
            openid=openid,
            creator=operator.staff_name,
            locked_by=serializer.validated_data.get("locked_by") or operator.staff_name,
        )
        self._sync_location_lock_state(lock.location)

    def perform_update(self, serializer: LocationLockSerializer) -> None:
        openid = self._current_openid()
        location = serializer.validated_data.get("location", serializer.instance.location)
        self._validate_location(location, openid)
        lock = serializer.save(creator=serializer.instance.creator)
        self._sync_location_lock_state(lock.location)

    def destroy(self, request: Request, *args: Any, **kwargs: Any) -> Response:
        instance = self.get_object()
        response = super().destroy(request, *args, **kwargs)
        self._sync_location_lock_state(instance.location)
        return response
