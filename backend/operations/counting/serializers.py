"""Serializers for cycle counting and variance approvals."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from inventory.models import InventoryAdjustmentApprovalRule, InventoryAdjustmentReason, InventoryBalance, InventoryMovement
from staff.models import ListModel as Staff
from utils import datasolve
from warehouse.models import Warehouse

from .models import CountApproval, CycleCount, CycleCountLine, CycleCountStatus


class CountApprovalSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    requested_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    approved_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    rejected_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    required_role = serializers.SerializerMethodField()
    adjustment_reason_code = serializers.CharField(source="cycle_count_line.adjustment_reason.code", read_only=True)
    count_number = serializers.CharField(source="cycle_count_line.cycle_count.count_number", read_only=True)
    warehouse_name = serializers.CharField(source="cycle_count_line.cycle_count.warehouse.warehouse_name", read_only=True)
    line_number = serializers.IntegerField(source="cycle_count_line.line_number", read_only=True)
    location_code = serializers.CharField(source="cycle_count_line.location.location_code", read_only=True)
    goods_code = serializers.CharField(source="cycle_count_line.goods.goods_code", read_only=True)
    variance_qty = serializers.DecimalField(source="cycle_count_line.variance_qty", max_digits=18, decimal_places=4, read_only=True)

    class Meta:
        model = CountApproval
        fields = [
            "id",
            "cycle_count_line",
            "count_number",
            "warehouse_name",
            "line_number",
            "location_code",
            "goods_code",
            "adjustment_reason_code",
            "variance_qty",
            "approval_rule",
            "required_role",
            "status",
            "requested_by",
            "requested_at",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields

    def get_required_role(self, obj: CountApproval) -> str:
        if obj.approval_rule_id:
            return obj.approval_rule.approver_role
        return "Manager"


class CycleCountLineSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    counted_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    location_code = serializers.CharField(source="location.location_code", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    adjustment_reason = serializers.PrimaryKeyRelatedField(
        queryset=InventoryAdjustmentReason.objects.filter(is_delete=False),
        allow_null=True,
        required=False,
    )
    adjustment_reason_code = serializers.CharField(source="adjustment_reason.code", read_only=True)
    counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), allow_null=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    assigned_to = serializers.PrimaryKeyRelatedField(read_only=True)
    assigned_to_name = serializers.CharField(source="assigned_to.staff_name", read_only=True)
    assigned_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    scanner_task_type = serializers.CharField(read_only=True)
    scanner_task_status = serializers.CharField(read_only=True)
    scanner_task_acknowledged_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    scanner_task_started_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    scanner_task_completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    scanner_task_last_operator = serializers.CharField(read_only=True)
    counted_by = serializers.CharField(read_only=True)
    recount_assigned_to = serializers.PrimaryKeyRelatedField(read_only=True)
    recount_assigned_to_name = serializers.CharField(source="recount_assigned_to.staff_name", read_only=True)
    recount_assigned_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    recount_counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, read_only=True)
    recounted_by = serializers.CharField(read_only=True)
    recounted_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    adjustment_movement = serializers.PrimaryKeyRelatedField(read_only=True)
    approval = CountApprovalSerializer(read_only=True)

    class Meta:
        model = CycleCountLine
        fields = [
            "id",
            "cycle_count",
            "line_number",
            "inventory_balance",
            "location",
            "location_code",
            "goods",
            "goods_code",
            "stock_status",
            "lot_number",
            "serial_number",
            "system_qty",
            "counted_qty",
            "variance_qty",
            "adjustment_reason",
            "adjustment_reason_code",
            "status",
            "assigned_to",
            "assigned_to_name",
            "assigned_at",
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_completed_at",
            "scanner_task_last_operator",
            "counted_by",
            "counted_at",
            "recount_assigned_to",
            "recount_assigned_to_name",
            "recount_assigned_at",
            "recount_counted_qty",
            "recounted_by",
            "recounted_at",
            "adjustment_movement",
            "approval",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "cycle_count",
            "line_number",
            "inventory_balance",
            "location",
            "location_code",
            "goods",
            "goods_code",
            "stock_status",
            "lot_number",
            "serial_number",
            "system_qty",
            "variance_qty",
            "status",
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_completed_at",
            "scanner_task_last_operator",
            "counted_by",
            "counted_at",
            "adjustment_movement",
            "approval",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def to_representation(self, instance: CycleCountLine) -> dict[str, object]:
        data = super().to_representation(instance)
        if self.context.get("hide_system_qty") and instance.cycle_count.is_blind_count and instance.adjustment_movement_id is None:
            data["system_qty"] = None
        return data


class CycleCountLineCreateSerializer(serializers.Serializer):
    inventory_balance = serializers.PrimaryKeyRelatedField(queryset=InventoryBalance.objects.filter(is_delete=False))
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)


class CycleCountLineAssignSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)


class CycleCountLineScanLookupSerializer(serializers.Serializer):
    count_number = serializers.CharField(validators=[datasolve.data_validate], required=False)
    location = serializers.CharField(validators=[datasolve.data_validate])
    sku = serializers.CharField(validators=[datasolve.data_validate])
    recount = serializers.BooleanField(required=False, default=False)


class CycleCountLineScanCountSerializer(CycleCountLineScanLookupSerializer):
    counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"))
    adjustment_reason = serializers.PrimaryKeyRelatedField(
        queryset=InventoryAdjustmentReason.objects.filter(is_delete=False),
        allow_null=True,
        required=False,
    )
    adjustment_reason_code = serializers.CharField(validators=[datasolve.data_validate], required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        adjustment_reason = attrs.get("adjustment_reason")
        adjustment_reason_code = attrs.pop("adjustment_reason_code", "")
        if adjustment_reason_code and adjustment_reason is None:
            request = self.context.get("request")
            openid = getattr(getattr(request, "auth", None), "openid", None)
            adjustment_reason = InventoryAdjustmentReason.objects.filter(
                openid=openid,
                code=adjustment_reason_code,
                is_delete=False,
            ).first()
            if adjustment_reason is None:
                raise serializers.ValidationError({"adjustment_reason_code": "Unknown adjustment reason code"})
            attrs["adjustment_reason"] = adjustment_reason
        return attrs


class CycleCountLineScannerCompleteSerializer(serializers.Serializer):
    counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"))
    adjustment_reason = serializers.PrimaryKeyRelatedField(
        queryset=InventoryAdjustmentReason.objects.filter(is_delete=False),
        allow_null=True,
        required=False,
    )
    adjustment_reason_code = serializers.CharField(validators=[datasolve.data_validate], required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)

    def validate(self, attrs):
        adjustment_reason = attrs.get("adjustment_reason")
        adjustment_reason_code = attrs.pop("adjustment_reason_code", "")
        if adjustment_reason_code and adjustment_reason is None:
            request = self.context.get("request")
            openid = getattr(getattr(request, "auth", None), "openid", None)
            adjustment_reason = InventoryAdjustmentReason.objects.filter(
                openid=openid,
                code=adjustment_reason_code,
                is_delete=False,
            ).first()
            if adjustment_reason is None:
                raise serializers.ValidationError({"adjustment_reason_code": "Unknown adjustment reason code"})
            attrs["adjustment_reason"] = adjustment_reason
        return attrs


class CycleCountSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    submitted_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    count_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    is_blind_count = serializers.BooleanField(required=False, default=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = CycleCountLineSerializer(many=True, read_only=True)
    line_items = CycleCountLineCreateSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)
    submitted_by = serializers.CharField(read_only=True)

    class Meta:
        model = CycleCount
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "count_number",
            "scheduled_date",
            "is_blind_count",
            "status",
            "notes",
            "lines",
            "line_items",
            "creator",
            "submitted_by",
            "submitted_at",
            "completed_at",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "status",
            "lines",
            "creator",
            "submitted_by",
            "submitted_at",
            "completed_at",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Cycle counts require at least one inventory balance"})
        if action == "create" and attrs.get("status") not in {None, CycleCountStatus.OPEN}:
            raise serializers.ValidationError({"status": "Cycle counts must start in OPEN status"})
        return attrs


class CountApprovalDecisionSerializer(serializers.Serializer):
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
