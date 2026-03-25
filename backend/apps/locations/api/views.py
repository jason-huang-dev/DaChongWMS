from __future__ import annotations

from decimal import Decimal

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.locations.models import Location, LocationLock, LocationStatus, LocationType, Zone, ZoneUsage
from apps.locations.permissions import CanManageLocationLocks, CanManageLocationTopology, CanViewLocations
from apps.locations.serializers import (
    LocationLockSerializer,
    LocationSerializer,
    LocationTypeSerializer,
    ZoneSerializer,
)
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationLockInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_lock,
    create_location_type,
    create_zone,
    list_location_locks,
    list_organization_location_types,
    list_organization_locations,
    list_organization_zones,
    update_location,
    update_location_lock,
    update_location_type,
    update_zone,
)
from apps.organizations.models import Organization
from apps.warehouse.models import Warehouse


def _actor_name_from_request(request: Request) -> str:
    email = getattr(request.user, "email", "")
    if isinstance(email, str) and email.strip():
        return email.strip()
    return "system"


class OrganizationLocationsBaseAPIView(APIView):
    organization: Organization

    def initial(self, request: Request, *args: object, **kwargs: object) -> None:
        self.organization = get_object_or_404(
            Organization,
            pk=kwargs["organization_id"],
            is_active=True,
        )
        super().initial(request, *args, **kwargs)

    def get_warehouse(self, warehouse_id: int) -> Warehouse:
        return get_object_or_404(
            Warehouse,
            pk=warehouse_id,
            organization=self.organization,
        )


class ZoneListCreateAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        zones = list_organization_zones(organization=self.organization)
        return Response(ZoneSerializer(zones, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = ZoneSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.get_warehouse(serializer.validated_data["warehouse_id"]),
                code=serializer.validated_data["code"],
                name=serializer.validated_data["name"],
                usage=serializer.validated_data.get("usage", ZoneUsage.STORAGE),
                sequence=serializer.validated_data.get("sequence", 0),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(ZoneSerializer(zone).data, status=status.HTTP_201_CREATED)


class ZoneDetailAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get_object(self, zone_id: int) -> Zone:
        return get_object_or_404(Zone, pk=zone_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        zone = self.get_object(kwargs["zone_id"])
        return Response(ZoneSerializer(zone).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        zone = self.get_object(kwargs["zone_id"])
        serializer = ZoneSerializer(zone, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        warehouse = None
        warehouse_id = serializer.validated_data.get("warehouse_id")
        if warehouse_id is not None:
            warehouse = self.get_warehouse(warehouse_id)
        updated = update_zone(
            zone,
            warehouse=warehouse,
            code=serializer.validated_data.get("code"),
            name=serializer.validated_data.get("name"),
            usage=serializer.validated_data.get("usage"),
            sequence=serializer.validated_data.get("sequence"),
            is_active=serializer.validated_data.get("is_active"),
        )
        return Response(ZoneSerializer(updated).data)


class LocationTypeListCreateAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_types = list_organization_location_types(organization=self.organization)
        return Response(LocationTypeSerializer(location_types, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = LocationTypeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code=serializer.validated_data["code"],
                name=serializer.validated_data["name"],
                picking_enabled=serializer.validated_data.get("picking_enabled", True),
                putaway_enabled=serializer.validated_data.get("putaway_enabled", True),
                allow_mixed_sku=serializer.validated_data.get("allow_mixed_sku", False),
                max_weight=serializer.validated_data.get("max_weight", Decimal("0.00")),
                max_volume=serializer.validated_data.get("max_volume", Decimal("0.0000")),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(LocationTypeSerializer(location_type).data, status=status.HTTP_201_CREATED)


class LocationTypeDetailAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get_object(self, location_type_id: int) -> LocationType:
        return get_object_or_404(
            LocationType,
            pk=location_type_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_type = self.get_object(kwargs["location_type_id"])
        return Response(LocationTypeSerializer(location_type).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_type = self.get_object(kwargs["location_type_id"])
        serializer = LocationTypeSerializer(location_type, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_location_type(
            location_type,
            code=serializer.validated_data.get("code"),
            name=serializer.validated_data.get("name"),
            picking_enabled=serializer.validated_data.get("picking_enabled"),
            putaway_enabled=serializer.validated_data.get("putaway_enabled"),
            allow_mixed_sku=serializer.validated_data.get("allow_mixed_sku"),
            max_weight=serializer.validated_data.get("max_weight"),
            max_volume=serializer.validated_data.get("max_volume"),
            is_active=serializer.validated_data.get("is_active"),
        )
        return Response(LocationTypeSerializer(updated).data)


class LocationListCreateAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        warehouse_id = request.query_params.get("warehouse_id")
        zone_id = request.query_params.get("zone_id")
        location_type_id = request.query_params.get("location_type_id")
        is_active = request.query_params.get("is_active")
        locations = list_organization_locations(
            organization=self.organization,
            warehouse_id=int(warehouse_id) if warehouse_id else None,
            zone_id=int(zone_id) if zone_id else None,
            location_type_id=int(location_type_id) if location_type_id else None,
            is_active=(is_active.lower() == "true") if is_active else None,
        )
        return Response(LocationSerializer(locations, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = LocationSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        warehouse = self.get_warehouse(serializer.validated_data["warehouse_id"])
        zone = get_object_or_404(
            Zone,
            pk=serializer.validated_data["zone_id"],
            organization=self.organization,
        )
        location_type = get_object_or_404(
            LocationType,
            pk=serializer.validated_data["location_type_id"],
            organization=self.organization,
        )
        location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=warehouse,
                zone=zone,
                location_type=location_type,
                code=serializer.validated_data["code"],
                name=serializer.validated_data.get("name", ""),
                aisle=serializer.validated_data.get("aisle", ""),
                bay=serializer.validated_data.get("bay", ""),
                level=serializer.validated_data.get("level", ""),
                slot=serializer.validated_data.get("slot", ""),
                barcode=serializer.validated_data.get("barcode", ""),
                capacity_qty=serializer.validated_data.get("capacity_qty", 0),
                max_weight=serializer.validated_data.get("max_weight", Decimal("0.00")),
                max_volume=serializer.validated_data.get("max_volume", Decimal("0.0000")),
                pick_sequence=serializer.validated_data.get("pick_sequence", 0),
                is_pick_face=serializer.validated_data.get("is_pick_face", False),
                status=serializer.validated_data.get("status", LocationStatus.AVAILABLE),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(LocationSerializer(location).data, status=status.HTTP_201_CREATED)


class LocationDetailAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationTopology()]

    def get_object(self, location_id: int) -> Location:
        return get_object_or_404(Location, pk=location_id, organization=self.organization)

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        location = self.get_object(kwargs["location_id"])
        return Response(LocationSerializer(location).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        location = self.get_object(kwargs["location_id"])
        serializer = LocationSerializer(location, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        warehouse = None
        warehouse_id = serializer.validated_data.get("warehouse_id")
        if warehouse_id is not None:
            warehouse = self.get_warehouse(warehouse_id)
        zone = None
        zone_id = serializer.validated_data.get("zone_id")
        if zone_id is not None:
            zone = get_object_or_404(Zone, pk=zone_id, organization=self.organization)
        location_type = None
        location_type_id = serializer.validated_data.get("location_type_id")
        if location_type_id is not None:
            location_type = get_object_or_404(
                LocationType,
                pk=location_type_id,
                organization=self.organization,
            )
        updated = update_location(
            location,
            warehouse=warehouse,
            zone=zone,
            location_type=location_type,
            code=serializer.validated_data.get("code"),
            name=serializer.validated_data.get("name"),
            aisle=serializer.validated_data.get("aisle"),
            bay=serializer.validated_data.get("bay"),
            level=serializer.validated_data.get("level"),
            slot=serializer.validated_data.get("slot"),
            barcode=serializer.validated_data.get("barcode"),
            capacity_qty=serializer.validated_data.get("capacity_qty"),
            max_weight=serializer.validated_data.get("max_weight"),
            max_volume=serializer.validated_data.get("max_volume"),
            pick_sequence=serializer.validated_data.get("pick_sequence"),
            is_pick_face=serializer.validated_data.get("is_pick_face"),
            status=serializer.validated_data.get("status"),
            is_active=serializer.validated_data.get("is_active"),
        )
        return Response(LocationSerializer(updated).data)


class LocationLockListCreateAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationLocks()]

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_id = request.query_params.get("location_id")
        is_active = request.query_params.get("is_active")
        locks = list_location_locks(
            organization=self.organization,
            location_id=int(location_id) if location_id else None,
            is_active=(is_active.lower() == "true") if is_active else None,
        )
        return Response(LocationLockSerializer(locks, many=True).data)

    def post(self, request: Request, *args: object, **kwargs: object) -> Response:
        serializer = LocationLockSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        location = get_object_or_404(
            Location,
            pk=serializer.validated_data["location_id"],
            organization=self.organization,
        )
        location_lock = create_location_lock(
            CreateLocationLockInput(
                organization=self.organization,
                location=location,
                reason=serializer.validated_data["reason"],
                notes=serializer.validated_data.get("notes", ""),
                locked_by=serializer.validated_data.get("locked_by") or _actor_name_from_request(request),
                is_active=serializer.validated_data.get("is_active", True),
            )
        )
        return Response(
            LocationLockSerializer(location_lock).data,
            status=status.HTTP_201_CREATED,
        )


class LocationLockDetailAPIView(OrganizationLocationsBaseAPIView):
    def get_permissions(self) -> list[object]:
        if self.request.method == "GET":
            return [CanViewLocations()]
        return [CanManageLocationLocks()]

    def get_object(self, location_lock_id: int) -> LocationLock:
        return get_object_or_404(
            LocationLock,
            pk=location_lock_id,
            organization=self.organization,
        )

    def get(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_lock = self.get_object(kwargs["location_lock_id"])
        return Response(LocationLockSerializer(location_lock).data)

    def patch(self, request: Request, *args: object, **kwargs: object) -> Response:
        location_lock = self.get_object(kwargs["location_lock_id"])
        serializer = LocationLockSerializer(location_lock, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        updated = update_location_lock(
            location_lock,
            reason=serializer.validated_data.get("reason"),
            notes=serializer.validated_data.get("notes"),
            is_active=serializer.validated_data.get("is_active"),
            released_by=(
                serializer.validated_data.get("released_by") or _actor_name_from_request(request)
                if serializer.validated_data.get("is_active") is False
                or "released_by" in serializer.validated_data
                else None
            ),
        )
        return Response(LocationLockSerializer(updated).data)
