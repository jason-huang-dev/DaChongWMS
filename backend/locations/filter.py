from django_filters import FilterSet

from .models import Location, LocationLock, LocationType, Zone


class ZoneFilter(FilterSet):
    class Meta:
        model = Zone
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "zone_code": ["exact", "iexact", "contains", "icontains"],
            "zone_name": ["exact", "iexact", "contains", "icontains"],
            "usage": ["exact"],
            "is_active": ["exact"],
            "creator": ["exact", "iexact", "contains", "icontains"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
            "update_time": ["gt", "gte", "lt", "lte", "range"],
        }


class LocationTypeFilter(FilterSet):
    class Meta:
        model = LocationType
        fields = {
            "id": ["exact", "in", "range"],
            "type_code": ["exact", "iexact", "contains", "icontains"],
            "type_name": ["exact", "iexact", "contains", "icontains"],
            "picking_enabled": ["exact"],
            "putaway_enabled": ["exact"],
            "allow_mixed_sku": ["exact"],
            "creator": ["exact", "iexact", "contains", "icontains"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
            "update_time": ["gt", "gte", "lt", "lte", "range"],
        }


class LocationFilter(FilterSet):
    class Meta:
        model = Location
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "zone": ["exact"],
            "location_type": ["exact"],
            "location_code": ["exact", "iexact", "contains", "icontains"],
            "location_name": ["exact", "iexact", "contains", "icontains"],
            "aisle": ["exact", "iexact", "contains", "icontains"],
            "bay": ["exact", "iexact", "contains", "icontains"],
            "level": ["exact", "iexact", "contains", "icontains"],
            "slot": ["exact", "iexact", "contains", "icontains"],
            "status": ["exact"],
            "is_pick_face": ["exact"],
            "is_locked": ["exact"],
            "creator": ["exact", "iexact", "contains", "icontains"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
            "update_time": ["gt", "gte", "lt", "lte", "range"],
        }


class LocationLockFilter(FilterSet):
    class Meta:
        model = LocationLock
        fields = {
            "id": ["exact", "in", "range"],
            "location": ["exact"],
            "reason": ["exact", "iexact", "contains", "icontains"],
            "locked_by": ["exact", "iexact", "contains", "icontains"],
            "is_active": ["exact"],
            "creator": ["exact", "iexact", "contains", "icontains"],
            "start_time": ["gt", "gte", "lt", "lte", "range"],
            "end_time": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
            "update_time": ["gt", "gte", "lt", "lte", "range"],
        }
