from __future__ import annotations

from rest_framework import serializers

from apps.locations.models import Location, LocationLock, LocationType, Zone


class ZoneSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()

    class Meta:
        model = Zone
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "code",
            "name",
            "usage",
            "sequence",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")


class LocationTypeSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = LocationType
        fields = (
            "id",
            "organization_id",
            "code",
            "name",
            "picking_enabled",
            "putaway_enabled",
            "allow_mixed_sku",
            "max_weight",
            "max_volume",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")


class LocationSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    zone_id = serializers.IntegerField()
    location_type_id = serializers.IntegerField()

    class Meta:
        model = Location
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "zone_id",
            "location_type_id",
            "code",
            "name",
            "aisle",
            "bay",
            "level",
            "slot",
            "barcode",
            "capacity_qty",
            "max_weight",
            "max_volume",
            "pick_sequence",
            "is_pick_face",
            "is_locked",
            "status",
            "is_active",
        )
        read_only_fields = ("id", "organization_id", "is_locked")


class LocationLockSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    location_id = serializers.IntegerField()
    locked_by = serializers.CharField(required=False, allow_blank=True)
    released_by = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = LocationLock
        fields = (
            "id",
            "organization_id",
            "location_id",
            "reason",
            "notes",
            "locked_by",
            "released_by",
            "is_active",
            "start_time",
            "end_time",
            "released_at",
        )
        read_only_fields = ("id", "organization_id", "start_time", "end_time", "released_at")
