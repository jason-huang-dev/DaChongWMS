from __future__ import annotations

from rest_framework.permissions import IsAuthenticated
from rest_framework.request import Request
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.common.api_compat import (
    decimal_to_string,
    empty_compat_response,
    get_compat_membership,
    get_optional_int,
    paginate_compat_list,
)
from apps.locations.models import Location


def _serialize_location(location: Location) -> dict[str, object]:
    return {
        "id": location.id,
        "warehouse": location.warehouse_id,
        "warehouse_name": location.warehouse.name,
        "zone": location.zone_id,
        "zone_code": location.zone.code,
        "location_type": location.location_type_id,
        "location_type_code": location.location_type.code,
        "location_code": location.code,
        "location_name": location.name,
        "aisle": location.aisle,
        "bay": location.bay,
        "level": location.level,
        "slot": location.slot,
        "barcode": location.barcode,
        "capacity_qty": str(location.capacity_qty),
        "max_weight": decimal_to_string(location.max_weight),
        "max_volume": decimal_to_string(location.max_volume),
        "pick_sequence": location.pick_sequence,
        "is_pick_face": location.is_pick_face,
        "is_locked": location.is_locked,
        "status": location.status,
        "creator": "",
        "openid": "",
        "create_time": "",
        "update_time": "",
    }


class CompatibilityLocationListAPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request: Request) -> Response:
        membership = get_compat_membership(request)
        if membership is None:
            return empty_compat_response(request=request, view=self)

        warehouse_id = get_optional_int(request, "warehouse", "warehouse_id")
        zone_id = get_optional_int(request, "zone", "zone_id")
        location_type_id = get_optional_int(request, "location_type", "location_type_id")

        queryset = (
            Location.objects.select_related("warehouse", "zone", "location_type")
            .filter(
                organization_id=membership.organization_id,
                warehouse__is_active=True,
                zone__is_active=True,
                location_type__is_active=True,
                is_active=True,
            )
            .order_by("warehouse__name", "pick_sequence", "code", "id")
        )
        if warehouse_id is not None:
            queryset = queryset.filter(warehouse_id=warehouse_id)
        if zone_id is not None:
            queryset = queryset.filter(zone_id=zone_id)
        if location_type_id is not None:
            queryset = queryset.filter(location_type_id=location_type_id)

        return paginate_compat_list(
            request=request,
            view=self,
            records=queryset,
            serializer=_serialize_location,
        )
