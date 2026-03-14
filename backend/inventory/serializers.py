"""Serializers for inventory state and mutation APIs."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from catalog.goods.models import ListModel as Goods
from locations.models import Location
from utils import datasolve
from warehouse.models import Warehouse

from .models import (
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
)


class TenantOpenidValidationMixin:
    def _current_openid(self) -> str:
        request = self.context.get("request")
        openid = getattr(getattr(request, "auth", None), "openid", None)
        if not isinstance(openid, str) or not openid:
            raise serializers.ValidationError({"detail": "Authentication token missing openid"})
        return openid


class InventoryBalanceSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    last_movement_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    location_code = serializers.CharField(source="location.location_code", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    available_qty = serializers.SerializerMethodField()

    class Meta:
        model = InventoryBalance
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "location",
            "location_code",
            "goods",
            "goods_code",
            "stock_status",
            "lot_number",
            "serial_number",
            "on_hand_qty",
            "allocated_qty",
            "hold_qty",
            "available_qty",
            "unit_cost",
            "currency",
            "creator",
            "openid",
            "last_movement_at",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields

    def get_available_qty(self, obj: InventoryBalance) -> Decimal:
        return obj.available_qty


class InventoryMovementSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    occurred_at = serializers.DateTimeField(required=False, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    from_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    reason = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    performed_by = serializers.CharField(read_only=True)
    creator = serializers.CharField(read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)

    class Meta:
        model = InventoryMovement
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "goods",
            "goods_code",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "movement_type",
            "stock_status",
            "lot_number",
            "serial_number",
            "quantity",
            "unit_cost",
            "reference_code",
            "reason",
            "performed_by",
            "creator",
            "openid",
            "occurred_at",
            "resulting_from_qty",
            "resulting_to_qty",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "performed_by",
            "creator",
            "openid",
            "resulting_from_qty",
            "resulting_to_qty",
            "create_time",
            "update_time",
            "warehouse_name",
            "goods_code",
            "from_location_code",
            "to_location_code",
        ]


class InventoryHoldSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    released_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    inventory_balance = serializers.PrimaryKeyRelatedField(queryset=InventoryBalance.objects.filter(is_delete=False))
    goods_code = serializers.CharField(source="inventory_balance.goods.goods_code", read_only=True)
    location_code = serializers.CharField(source="inventory_balance.location.location_code", read_only=True)
    reason = serializers.CharField(validators=[datasolve.data_validate], max_length=255)
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    creator = serializers.CharField(read_only=True)
    held_by = serializers.CharField(read_only=True)
    released_by = serializers.CharField(read_only=True)

    class Meta:
        model = InventoryHold
        fields = [
            "id",
            "inventory_balance",
            "goods_code",
            "location_code",
            "quantity",
            "reason",
            "reference_code",
            "notes",
            "held_by",
            "released_by",
            "released_at",
            "is_active",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "goods_code",
            "location_code",
            "held_by",
            "released_by",
            "released_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class InventoryAdjustmentReasonSerializer(TenantOpenidValidationMixin, serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    code = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    name = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    description = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = InventoryAdjustmentReason
        fields = [
            "id",
            "code",
            "name",
            "description",
            "direction",
            "requires_approval",
            "is_active",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "creator", "openid", "create_time", "update_time"]


class InventoryAdjustmentApprovalRuleSerializer(TenantOpenidValidationMixin, serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    adjustment_reason = serializers.PrimaryKeyRelatedField(queryset=InventoryAdjustmentReason.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False), allow_null=True, required=False)
    adjustment_reason_code = serializers.CharField(source="adjustment_reason.code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    approver_role = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = InventoryAdjustmentApprovalRule
        fields = [
            "id",
            "adjustment_reason",
            "adjustment_reason_code",
            "warehouse",
            "warehouse_name",
            "minimum_variance_qty",
            "approver_role",
            "is_active",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "adjustment_reason_code",
            "warehouse_name",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        openid = self._current_openid()
        reason = attrs.get("adjustment_reason", getattr(self.instance, "adjustment_reason", None))
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        if reason is not None and reason.openid != openid:
            raise serializers.ValidationError({"adjustment_reason": "Adjustment reason must belong to the authenticated tenant"})
        if warehouse is not None and warehouse.openid != openid:
            raise serializers.ValidationError({"warehouse": "Warehouse must belong to the authenticated tenant"})
        return attrs
