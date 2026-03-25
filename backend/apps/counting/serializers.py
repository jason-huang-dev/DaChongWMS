from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.counting.models import CountApproval, CycleCount, CycleCountLine


class CycleCountLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1, required=False)
    inventory_balance_id = serializers.IntegerField()
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)


class CycleCountLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    cycle_count_id = serializers.IntegerField(read_only=True)
    inventory_balance_id = serializers.IntegerField(read_only=True, allow_null=True)
    location_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    adjustment_reason_id = serializers.IntegerField(required=False, allow_null=True)
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    recount_assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    adjustment_movement_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = CycleCountLine
        fields = (
            "id",
            "organization_id",
            "cycle_count_id",
            "line_number",
            "inventory_balance_id",
            "location_id",
            "product_id",
            "stock_status",
            "lot_number",
            "serial_number",
            "system_qty",
            "counted_qty",
            "variance_qty",
            "adjustment_reason_id",
            "status",
            "assigned_membership_id",
            "assigned_at",
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_completed_at",
            "scanner_task_last_operator",
            "counted_by",
            "counted_at",
            "recount_assigned_membership_id",
            "recount_assigned_at",
            "recount_counted_qty",
            "recounted_by",
            "recounted_at",
            "adjustment_movement_id",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "cycle_count_id",
            "line_number",
            "inventory_balance_id",
            "location_id",
            "product_id",
            "stock_status",
            "lot_number",
            "serial_number",
            "system_qty",
            "variance_qty",
            "assigned_at",
            "scanner_task_type",
            "scanner_task_status",
            "scanner_task_acknowledged_at",
            "scanner_task_started_at",
            "scanner_task_completed_at",
            "scanner_task_last_operator",
            "counted_by",
            "counted_at",
            "recount_assigned_at",
            "recount_counted_qty",
            "recounted_by",
            "recounted_at",
            "adjustment_movement_id",
            "create_time",
            "update_time",
        )


class CycleCountSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    line_items = CycleCountLineInputSerializer(many=True, write_only=True, required=False)
    lines = CycleCountLineSerializer(many=True, read_only=True)

    class Meta:
        model = CycleCount
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "count_number",
            "scheduled_date",
            "is_blind_count",
            "status",
            "notes",
            "submitted_by",
            "submitted_at",
            "completed_at",
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "status",
            "submitted_by",
            "submitted_at",
            "completed_at",
            "lines",
            "create_time",
            "update_time",
        )


class CountApprovalSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    cycle_count_line_id = serializers.IntegerField(read_only=True)
    approval_rule_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = CountApproval
        fields = (
            "id",
            "organization_id",
            "cycle_count_line_id",
            "approval_rule_id",
            "status",
            "requested_by",
            "requested_at",
            "approved_by",
            "approved_at",
            "rejected_by",
            "rejected_at",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class CycleCountLineAssignSerializer(serializers.Serializer):
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)


class CycleCountLineScannerLookupSerializer(serializers.Serializer):
    location = serializers.CharField()
    sku = serializers.CharField()
    count_number = serializers.CharField(required=False, allow_blank=True, default="")
    recount = serializers.BooleanField(required=False, default=False)


class CycleCountLineScannerCompleteSerializer(serializers.Serializer):
    counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"))
    adjustment_reason_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CycleCountLineScanCountSerializer(CycleCountLineScannerLookupSerializer):
    counted_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"))
    adjustment_reason_id = serializers.IntegerField(required=False, allow_null=True)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class CountApprovalDecisionSerializer(serializers.Serializer):
    notes = serializers.CharField(required=False, allow_blank=True, default="")
