from django_filters import FilterSet

from .models import InventoryBalance, InventoryHold, InventoryMovement


class InventoryBalanceFilter(FilterSet):
    class Meta:
        model = InventoryBalance
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "location": ["exact"],
            "goods": ["exact"],
            "stock_status": ["exact"],
            "lot_number": ["exact", "icontains"],
            "serial_number": ["exact", "icontains"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
            "update_time": ["gt", "gte", "lt", "lte", "range"],
        }


class InventoryMovementFilter(FilterSet):
    class Meta:
        model = InventoryMovement
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "goods": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact"],
            "movement_type": ["exact"],
            "stock_status": ["exact"],
            "reference_code": ["exact", "icontains"],
            "performed_by": ["exact", "icontains"],
            "occurred_at": ["gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class InventoryHoldFilter(FilterSet):
    class Meta:
        model = InventoryHold
        fields = {
            "id": ["exact", "in", "range"],
            "inventory_balance": ["exact"],
            "is_active": ["exact"],
            "reason": ["exact", "icontains"],
            "reference_code": ["exact", "icontains"],
            "held_by": ["exact", "icontains"],
            "released_by": ["exact", "icontains"],
            "released_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
