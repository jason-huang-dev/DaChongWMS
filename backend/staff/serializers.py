"""Serializers for staff CRUD endpoints."""

from __future__ import annotations

from rest_framework import serializers

from utils import datasolve

from .models import ListModel, TypeListModel


class StaffGetSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = ListModel
        exclude = ["openid", "is_delete"]
        read_only_fields = ["id", "staff_name", "staff_type", "check_code"]


class StaffPostSerializer(serializers.ModelSerializer):
    openid = serializers.CharField(required=False, validators=[datasolve.openid_validate])
    staff_name = serializers.CharField(validators=[datasolve.data_validate])
    staff_type = serializers.CharField(validators=[datasolve.data_validate])
    check_code = serializers.IntegerField(validators=[datasolve.data_validate])

    class Meta:
        model = ListModel
        exclude = ["is_delete"]
        read_only_fields = ["id", "create_time", "update_time"]


class StaffUpdateSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(validators=[datasolve.data_validate])
    staff_type = serializers.CharField(validators=[datasolve.data_validate])

    class Meta:
        model = ListModel
        exclude = ["openid", "is_delete"]
        read_only_fields = ["id", "create_time", "update_time"]


class StaffPartialUpdateSerializer(serializers.ModelSerializer):
    staff_name = serializers.CharField(required=False, validators=[datasolve.data_validate])
    staff_type = serializers.CharField(required=False, validators=[datasolve.data_validate])

    class Meta:
        model = ListModel
        exclude = ["openid", "is_delete"]
        read_only_fields = ["id", "create_time", "update_time"]


class FileRenderSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = ListModel
        ref_name = "StaffFileRenderSerializer"
        exclude = ["openid", "is_delete"]


class StaffTypeGetSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = TypeListModel
        exclude = ["openid"]
        read_only_fields = ["id", "creator"]
