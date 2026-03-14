"""Serializers for transfer and replenishment workflows."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from catalog.goods.models import ListModel as Goods
from inventory.models import InventoryBalance, InventoryMovement, InventoryStatus
from locations.models import Location
from staff.models import ListModel as Staff
from utils import datasolve
from warehouse.models import Warehouse

from .models import (
    ReplenishmentRule,
    ReplenishmentTask,
    ReplenishmentTaskStatus,
    TransferLine,
    TransferLineStatus,
    TransferOrder,
    TransferOrderStatus,
)


class TransferLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)
    assigned_to_name = serializers.CharField(source="assigned_to.staff_name", read_only=True)
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=False, required=False)

    class Meta:
        model = TransferLine
        fields = [
            "id",
            "transfer_order",
            "line_number",
            "goods",
            "goods_code",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "requested_qty",
            "moved_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_to",
            "assigned_to_name",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "transfer_order",
            "line_number",
            "goods",
            "goods_code",
            "from_location",
            "from_location_code",
            "requested_qty",
            "moved_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action in {"update", "partial_update"} and attrs.get("status") == TransferLineStatus.COMPLETED:
            raise serializers.ValidationError({"status": "Use the complete endpoint to finish transfer lines"})
        return attrs


class TransferLineWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    from_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    requested_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")


class TransferOrderSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    transfer_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = TransferLineSerializer(many=True, read_only=True)
    line_items = TransferLineWriteSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = TransferOrder
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "transfer_number",
            "requested_date",
            "reference_code",
            "status",
            "notes",
            "lines",
            "line_items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "warehouse_name", "lines", "creator", "openid", "create_time", "update_time"]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Transfer orders require at least one line item"})
        if action in {"update", "partial_update"} and "line_items" in attrs:
            raise serializers.ValidationError({"line_items": "Transfer order lines cannot be changed through header updates"})
        if action in {"update", "partial_update"} and "transfer_number" in attrs and self.instance and attrs["transfer_number"] != self.instance.transfer_number:
            raise serializers.ValidationError({"transfer_number": "Transfer numbers are immutable once created"})
        if action in {"update", "partial_update"} and attrs.get("status") in {TransferOrderStatus.IN_PROGRESS, TransferOrderStatus.COMPLETED}:
            raise serializers.ValidationError({"status": "Transfer status is system-managed beyond cancellation"})
        return attrs


class TransferLineCompleteSerializer(serializers.Serializer):
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)


class ReplenishmentRuleSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    source_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    target_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    source_location_code = serializers.CharField(source="source_location.location_code", read_only=True)
    target_location_code = serializers.CharField(source="target_location.location_code", read_only=True)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = ReplenishmentRule
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "goods",
            "goods_code",
            "source_location",
            "source_location_code",
            "target_location",
            "target_location_code",
            "minimum_qty",
            "target_qty",
            "stock_status",
            "priority",
            "is_active",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "goods_code",
            "source_location_code",
            "target_location_code",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        warehouse = attrs.get("warehouse", getattr(self.instance, "warehouse", None))
        source_location = attrs.get("source_location", getattr(self.instance, "source_location", None))
        target_location = attrs.get("target_location", getattr(self.instance, "target_location", None))
        minimum_qty = attrs.get("minimum_qty", getattr(self.instance, "minimum_qty", None))
        target_qty = attrs.get("target_qty", getattr(self.instance, "target_qty", None))
        if source_location is not None and target_location is not None and source_location.pk == target_location.pk:
            raise serializers.ValidationError({"target_location": "Source and target locations must be different"})
        if warehouse is not None:
            if source_location is not None and source_location.warehouse_id != warehouse.id:
                raise serializers.ValidationError({"source_location": "Source location must belong to the selected warehouse"})
            if target_location is not None and target_location.warehouse_id != warehouse.id:
                raise serializers.ValidationError({"target_location": "Target location must belong to the selected warehouse"})
        if minimum_qty is not None and target_qty is not None and target_qty <= minimum_qty:
            raise serializers.ValidationError({"target_qty": "Target qty must be greater than the minimum qty"})
        return attrs


class ReplenishmentTaskSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    generated_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    source_balance = serializers.PrimaryKeyRelatedField(read_only=True)
    replenishment_rule = serializers.PrimaryKeyRelatedField(read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)
    assigned_to_name = serializers.CharField(source="assigned_to.staff_name", read_only=True)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=False, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)
    completed_by = serializers.CharField(read_only=True)

    class Meta:
        model = ReplenishmentTask
        fields = [
            "id",
            "replenishment_rule",
            "warehouse",
            "warehouse_name",
            "source_balance",
            "goods",
            "goods_code",
            "task_number",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "quantity",
            "priority",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_to",
            "assigned_to_name",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "notes",
            "generated_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "replenishment_rule",
            "warehouse",
            "warehouse_name",
            "source_balance",
            "goods",
            "goods_code",
            "task_number",
            "from_location",
            "from_location_code",
            "quantity",
            "priority",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "generated_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action in {"update", "partial_update"} and attrs.get("status") == ReplenishmentTaskStatus.COMPLETED:
            raise serializers.ValidationError({"status": "Use the complete endpoint to finish replenishment tasks"})
        return attrs


class ReplenishmentGenerateSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)


class ReplenishmentTaskCompleteSerializer(serializers.Serializer):
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
