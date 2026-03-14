from django_filters import FilterSet

from .models import CountApproval, CycleCount, CycleCountLine


class CycleCountFilter(FilterSet):
    class Meta:
        model = CycleCount
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "count_number": ["exact", "icontains"],
            "status": ["exact"],
            "scheduled_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "submitted_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class CycleCountLineFilter(FilterSet):
    class Meta:
        model = CycleCountLine
        fields = {
            "id": ["exact", "in", "range"],
            "cycle_count": ["exact"],
            "inventory_balance": ["exact", "isnull"],
            "location": ["exact"],
            "goods": ["exact"],
            "adjustment_reason": ["exact", "isnull"],
            "assigned_to": ["exact", "isnull"],
            "recount_assigned_to": ["exact", "isnull"],
            "scanner_task_type": ["exact"],
            "scanner_task_status": ["exact"],
            "status": ["exact"],
            "counted_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "recounted_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "scanner_task_acknowledged_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "scanner_task_started_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "scanner_task_completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class CountApprovalFilter(FilterSet):
    class Meta:
        model = CountApproval
        fields = {
            "id": ["exact", "in", "range"],
            "cycle_count_line": ["exact"],
            "approval_rule": ["exact", "isnull"],
            "status": ["exact"],
            "requested_by": ["exact", "icontains"],
            "approved_by": ["exact", "icontains"],
            "rejected_by": ["exact", "icontains"],
            "requested_at": ["gt", "gte", "lt", "lte", "range"],
            "approved_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "rejected_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
