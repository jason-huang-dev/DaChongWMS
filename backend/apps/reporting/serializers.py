from __future__ import annotations

from rest_framework import serializers

from apps.reporting.models import OperationalReportExport, WarehouseKpiSnapshot


class WarehouseKpiSnapshotSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()

    class Meta:
        model = WarehouseKpiSnapshot
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "snapshot_date",
            "generated_at",
            "generated_by",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "open_purchase_orders",
            "open_sales_orders",
            "open_putaway_tasks",
            "open_pick_tasks",
            "pending_count_approvals",
            "pending_return_orders",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "generated_at",
            "generated_by",
            "on_hand_qty",
            "available_qty",
            "allocated_qty",
            "hold_qty",
            "open_purchase_orders",
            "open_sales_orders",
            "open_putaway_tasks",
            "open_pick_tasks",
            "pending_count_approvals",
            "pending_return_orders",
            "create_time",
            "update_time",
        )


class OperationalReportExportSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)

    class Meta:
        model = OperationalReportExport
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "report_type",
            "status",
            "export_format",
            "date_from",
            "date_to",
            "parameters",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "status",
            "export_format",
            "file_name",
            "row_count",
            "generated_at",
            "generated_by",
            "content",
            "create_time",
            "update_time",
        )

