from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.transfers.models import (
    ReplenishmentRule,
    ReplenishmentTask,
    TransferLine,
    TransferOrder,
)


class TransferLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    product_id = serializers.IntegerField()
    from_location_id = serializers.IntegerField()
    to_location_id = serializers.IntegerField()
    requested_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.CharField(required=False, default="AVAILABLE")
    lot_number = serializers.CharField(required=False, allow_blank=True, default="")
    serial_number = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)


class TransferLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    transfer_order_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    from_location_id = serializers.IntegerField(read_only=True)
    to_location_id = serializers.IntegerField(required=False)
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    inventory_movement_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = TransferLine
        fields = (
            "id",
            "organization_id",
            "transfer_order_id",
            "line_number",
            "product_id",
            "from_location_id",
            "to_location_id",
            "requested_qty",
            "moved_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_membership_id",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "transfer_order_id",
            "line_number",
            "product_id",
            "from_location_id",
            "requested_qty",
            "moved_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )


class TransferOrderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    lines = TransferLineSerializer(many=True, read_only=True)
    line_items = TransferLineInputSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = TransferOrder
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "transfer_number",
            "requested_date",
            "reference_code",
            "status",
            "notes",
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = ("id", "organization_id", "lines", "create_time", "update_time")


class TransferLineCompleteSerializer(serializers.Serializer):
    to_location_id = serializers.IntegerField(required=False)


class ReplenishmentRuleSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    product_id = serializers.IntegerField()
    source_location_id = serializers.IntegerField()
    target_location_id = serializers.IntegerField()

    class Meta:
        model = ReplenishmentRule
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "product_id",
            "source_location_id",
            "target_location_id",
            "minimum_qty",
            "target_qty",
            "stock_status",
            "priority",
            "is_active",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = ("id", "organization_id", "create_time", "update_time")


class ReplenishmentGenerateSerializer(serializers.Serializer):
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)


class ReplenishmentTaskSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    replenishment_rule_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(read_only=True)
    source_balance_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    from_location_id = serializers.IntegerField(read_only=True)
    to_location_id = serializers.IntegerField(required=False)
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    inventory_movement_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ReplenishmentTask
        fields = (
            "id",
            "organization_id",
            "replenishment_rule_id",
            "warehouse_id",
            "source_balance_id",
            "product_id",
            "task_number",
            "from_location_id",
            "to_location_id",
            "quantity",
            "priority",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_membership_id",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "notes",
            "generated_at",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "replenishment_rule_id",
            "warehouse_id",
            "source_balance_id",
            "product_id",
            "task_number",
            "from_location_id",
            "quantity",
            "priority",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "generated_at",
            "create_time",
            "update_time",
        )


class ReplenishmentTaskCompleteSerializer(serializers.Serializer):
    to_location_id = serializers.IntegerField(required=False)
