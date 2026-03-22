from django.contrib import admin

from .models import WorkOrder, WorkOrderType


@admin.register(WorkOrderType)
class WorkOrderTypeAdmin(admin.ModelAdmin):
    list_display = (
        "organization",
        "code",
        "name",
        "workstream",
        "default_urgency",
        "default_priority_score",
        "target_sla_hours",
        "is_active",
    )
    search_fields = ("organization__name", "code", "name", "description")
    list_filter = ("workstream", "default_urgency", "is_active")


@admin.register(WorkOrder)
class WorkOrderAdmin(admin.ModelAdmin):
    list_display = (
        "display_code",
        "organization",
        "work_order_type",
        "warehouse",
        "customer_account",
        "title",
        "status",
        "urgency",
        "priority_score",
        "due_at",
    )
    search_fields = (
        "title",
        "source_reference",
        "assignee_name",
        "warehouse__code",
        "warehouse__name",
        "customer_account__code",
        "customer_account__name",
    )
    list_filter = ("status", "urgency", "work_order_type__workstream")

