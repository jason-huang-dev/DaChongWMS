from django_filters import FilterSet

from .models import ReplenishmentRule, ReplenishmentTask, TransferLine, TransferOrder


class TransferOrderFilter(FilterSet):
    class Meta:
        model = TransferOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "transfer_number": ["exact", "icontains"],
            "status": ["exact"],
            "requested_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class TransferLineFilter(FilterSet):
    class Meta:
        model = TransferLine
        fields = {
            "id": ["exact", "in", "range"],
            "transfer_order": ["exact"],
            "goods": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact"],
            "status": ["exact"],
            "assigned_to": ["exact", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReplenishmentRuleFilter(FilterSet):
    class Meta:
        model = ReplenishmentRule
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "goods": ["exact"],
            "source_location": ["exact"],
            "target_location": ["exact"],
            "stock_status": ["exact"],
            "is_active": ["exact"],
            "priority": ["exact", "range", "gt", "gte", "lt", "lte"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReplenishmentTaskFilter(FilterSet):
    class Meta:
        model = ReplenishmentTask
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "replenishment_rule": ["exact", "isnull"],
            "goods": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact"],
            "status": ["exact"],
            "assigned_to": ["exact", "isnull"],
            "generated_at": ["gt", "gte", "lt", "lte", "range"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
