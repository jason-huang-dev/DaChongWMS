from __future__ import annotations

from rest_framework import serializers

from .models import WorkOrder, WorkOrderType


class WorkOrderTypeSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = WorkOrderType
        fields = (
            "id",
            "organization_id",
            "code",
            "name",
            "description",
            "workstream",
            "default_urgency",
            "default_priority_score",
            "target_sla_hours",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")


class WorkOrderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    work_order_type_id = serializers.IntegerField()
    work_order_type_name = serializers.CharField(source="work_order_type.name", read_only=True)
    workstream = serializers.CharField(source="work_order_type.workstream", read_only=True)
    warehouse_id = serializers.IntegerField(required=False, allow_null=True)
    warehouse_name = serializers.CharField(source="warehouse.name", read_only=True)
    customer_account_id = serializers.IntegerField(required=False, allow_null=True)
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    display_code = serializers.CharField(read_only=True)
    fulfillment_rank = serializers.IntegerField(read_only=True, allow_null=True)
    sla_status = serializers.CharField(read_only=True)

    class Meta:
        model = WorkOrder
        fields = (
            "id",
            "organization_id",
            "display_code",
            "work_order_type_id",
            "work_order_type_name",
            "workstream",
            "warehouse_id",
            "warehouse_name",
            "customer_account_id",
            "customer_account_name",
            "title",
            "source_reference",
            "status",
            "urgency",
            "priority_score",
            "assignee_name",
            "scheduled_start_at",
            "due_at",
            "started_at",
            "completed_at",
            "estimated_duration_minutes",
            "notes",
            "fulfillment_rank",
            "sla_status",
            "created_at",
            "updated_at",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "display_code",
            "work_order_type_name",
            "workstream",
            "warehouse_name",
            "customer_account_name",
            "fulfillment_rank",
            "sla_status",
            "created_at",
            "updated_at",
        )

