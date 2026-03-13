"""Filter classes for staff endpoints."""

from __future__ import annotations

from django_filters import FilterSet

from .models import ListModel, TypeListModel


class StaffFilter(FilterSet):
    class Meta:
        model = ListModel
        fields = {
            "id": ["exact", "gt", "gte", "lt", "lte", "in"],
            "staff_name": ["exact", "icontains"],
            "staff_type": ["exact", "icontains"],
            "check_code": ["exact"],
            "create_time": ["year", "month", "day", "gt", "gte", "lt", "lte", "range"],
            "update_time": ["year", "month", "day", "gt", "gte", "lt", "lte", "range"],
        }


class StaffTypeFilter(FilterSet):
    class Meta:
        model = TypeListModel
        fields = {
            "id": ["exact", "gt", "gte", "lt", "lte", "in"],
            "staff_type": ["exact", "icontains"],
            "create_time": ["year", "month", "day", "gt", "gte", "lt", "lte", "range"],
            "update_time": ["year", "month", "day", "gt", "gte", "lt", "lte", "range"],
        }
