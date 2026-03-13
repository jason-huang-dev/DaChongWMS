"""Serializers for location topology APIs."""

from __future__ import annotations

from rest_framework import serializers

from utils import datasolve
from warehouse.models import Warehouse

from .models import Location, LocationLock, LocationType, Zone


class ZoneSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    zone_code = serializers.CharField(validators=[datasolve.data_validate], max_length=64)
    zone_name = serializers.CharField(validators=[datasolve.data_validate], max_length=255)
    class Meta:
        model = Zone
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "zone_code",
            "zone_name",
            "usage",
            "sequence",
            "is_active",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "creator", "openid", "create_time", "update_time", "warehouse_name"]


class LocationTypeSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    type_code = serializers.CharField(validators=[datasolve.data_validate], max_length=64)
    type_name = serializers.CharField(validators=[datasolve.data_validate], max_length=255)
    class Meta:
        model = LocationType
        fields = [
            "id",
            "type_code",
            "type_name",
            "picking_enabled",
            "putaway_enabled",
            "allow_mixed_sku",
            "max_weight",
            "max_volume",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "creator", "openid", "create_time", "update_time"]


class LocationSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    zone = serializers.PrimaryKeyRelatedField(queryset=Zone.objects.filter(is_delete=False))
    location_type = serializers.PrimaryKeyRelatedField(queryset=LocationType.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    zone_code = serializers.CharField(source="zone.zone_code", read_only=True)
    location_type_code = serializers.CharField(source="location_type.type_code", read_only=True)
    location_code = serializers.CharField(validators=[datasolve.data_validate], max_length=64)
    location_name = serializers.CharField(validators=[datasolve.data_validate], max_length=255, allow_blank=True, required=False)
    aisle = serializers.CharField(validators=[datasolve.data_validate], max_length=64, allow_blank=True, required=False)
    bay = serializers.CharField(validators=[datasolve.data_validate], max_length=64, allow_blank=True, required=False)
    level = serializers.CharField(validators=[datasolve.data_validate], max_length=64, allow_blank=True, required=False)
    slot = serializers.CharField(validators=[datasolve.data_validate], max_length=64, allow_blank=True, required=False)
    barcode = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    class Meta:
        model = Location
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "zone",
            "zone_code",
            "location_type",
            "location_type_code",
            "location_code",
            "location_name",
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
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "creator",
            "openid",
            "create_time",
            "update_time",
            "warehouse_name",
            "zone_code",
            "location_type_code",
            "is_locked",
        ]


class LocationLockSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    location_code = serializers.CharField(source="location.location_code", read_only=True)
    reason = serializers.CharField(validators=[datasolve.data_validate], max_length=255)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    locked_by = serializers.CharField(validators=[datasolve.data_validate], max_length=255)
    class Meta:
        model = LocationLock
        fields = [
            "id",
            "location",
            "location_code",
            "reason",
            "notes",
            "locked_by",
            "is_active",
            "start_time",
            "end_time",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "creator", "openid", "create_time", "update_time", "location_code"]
