"""Warehouse serializers."""


from rest_framework import serializers

from utils import datasolve

from .models import Warehouse


class WarehouseGetSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = Warehouse
        exclude = ["is_delete"]
        read_only_fields = ["id", "openid"]


class WarehousePostSerializer(serializers.ModelSerializer):
    openid = serializers.CharField(required=False, validators=[datasolve.openid_validate])
    warehouse_name = serializers.CharField(validators=[datasolve.data_validate], max_length=45, min_length=1)
    warehouse_city = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_address = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_contact = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_manager = serializers.CharField(validators=[datasolve.data_validate])
    creator = serializers.CharField(validators=[datasolve.data_validate])

    class Meta:
        model = Warehouse
        exclude = ["is_delete"]
        read_only_fields = ["id", "create_time", "update_time"]


class WarehouseUpdateSerializer(serializers.ModelSerializer):
    warehouse_name = serializers.CharField(validators=[datasolve.data_validate], max_length=45, min_length=1)
    warehouse_city = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_address = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_contact = serializers.CharField(validators=[datasolve.data_validate])
    warehouse_manager = serializers.CharField(validators=[datasolve.data_validate])
    creator = serializers.CharField(validators=[datasolve.data_validate])

    class Meta:
        model = Warehouse
        exclude = ["openid", "is_delete"]
        read_only_fields = ["id", "create_time", "update_time"]


class WarehousePartialUpdateSerializer(WarehouseUpdateSerializer):
    class Meta(WarehouseUpdateSerializer.Meta):
        pass
