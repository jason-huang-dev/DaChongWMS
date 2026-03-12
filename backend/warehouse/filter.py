from django_filters import FilterSet

from .models import Warehouse


class WarehouseFilter(FilterSet):
    class Meta:
        model = Warehouse
        fields = {
            "id": ["exact", "gt", "gte", "lt", "lte", "isnull", "in", "range"],
            "warehouse_name": ["exact", "iexact", "contains", "icontains"],
            "warehouse_city": ["exact", "iexact", "contains", "icontains"],
            "warehouse_address": ["exact", "iexact", "contains", "icontains"],
            "warehouse_contact": ["exact", "iexact", "contains", "icontains"],
            "warehouse_manager": ["exact", "iexact", "contains", "icontains"],
            "creator": ["exact", "iexact", "contains", "icontains"],
            "is_delete": ["exact"],
            "create_time": ["year", "month", "day", "week_day", "gt", "gte", "lt", "lte", "range"],
            "update_time": ["year", "month", "day", "week_day", "gt", "gte", "lt", "lte", "range"],
        }
