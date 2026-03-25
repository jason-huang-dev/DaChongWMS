from __future__ import annotations

from rest_framework import serializers

from apps.inventory.models import (
    InventoryAdjustmentApprovalRule,
    InventoryAdjustmentReason,
    InventoryBalance,
    InventoryHold,
    InventoryMovement,
)


class InventoryBalanceSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(read_only=True)
    location_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    available_qty = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)

    class Meta:
        model = InventoryBalance
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "location_id",
            "product_id",
            "stock_status",
            "lot_number",
            "serial_number",
            "on_hand_qty",
            "allocated_qty",
            "hold_qty",
            "available_qty",
            "unit_cost",
            "currency",
            "last_movement_at",
        )
        read_only_fields = fields


class InventoryMovementSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    from_location_id = serializers.IntegerField(required=False, allow_null=True)
    to_location_id = serializers.IntegerField(required=False, allow_null=True)
    performed_by = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = InventoryMovement
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "product_id",
            "from_location_id",
            "to_location_id",
            "movement_type",
            "stock_status",
            "lot_number",
            "serial_number",
            "quantity",
            "unit_cost",
            "currency",
            "reference_code",
            "reason",
            "performed_by",
            "occurred_at",
            "resulting_from_qty",
            "resulting_to_qty",
        )
        read_only_fields = ("id", "organization_id", "resulting_from_qty", "resulting_to_qty")


class InventoryHoldSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    inventory_balance_id = serializers.IntegerField()
    held_by = serializers.CharField(required=False, allow_blank=True)
    released_by = serializers.CharField(required=False, allow_blank=True)

    class Meta:
        model = InventoryHold
        fields = (
            "id",
            "organization_id",
            "inventory_balance_id",
            "quantity",
            "reason",
            "reference_code",
            "notes",
            "held_by",
            "released_by",
            "released_at",
            "is_active",
        )
        read_only_fields = ("id", "organization_id", "released_at")


class InventoryAdjustmentReasonSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = InventoryAdjustmentReason
        fields = (
            "id",
            "organization_id",
            "code",
            "name",
            "description",
            "direction",
            "requires_approval",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")


class InventoryAdjustmentApprovalRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    adjustment_reason_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = InventoryAdjustmentApprovalRule
        fields = (
            "id",
            "organization_id",
            "adjustment_reason_id",
            "warehouse_id",
            "minimum_variance_qty",
            "approver_role",
            "is_active",
            "notes",
        )
        read_only_fields = ("id", "organization_id")
