from django_filters import FilterSet

from .models import DockLoadVerification, PickTask, SalesOrder, Shipment


class SalesOrderFilter(FilterSet):
    class Meta:
        model = SalesOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "customer": ["exact"],
            "staging_location": ["exact"],
            "order_number": ["exact", "icontains"],
            "status": ["exact"],
            "requested_ship_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PickTaskFilter(FilterSet):
    class Meta:
        model = PickTask
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "goods": ["exact"],
            "sales_order_line": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact"],
            "task_number": ["exact", "icontains"],
            "status": ["exact"],
            "assigned_to": ["exact", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ShipmentFilter(FilterSet):
    class Meta:
        model = Shipment
        fields = {
            "id": ["exact", "in", "range"],
            "sales_order": ["exact"],
            "warehouse": ["exact"],
            "staging_location": ["exact"],
            "shipment_number": ["exact", "icontains"],
            "status": ["exact"],
            "shipped_by": ["exact", "icontains"],
            "shipped_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class DockLoadVerificationFilter(FilterSet):
    class Meta:
        model = DockLoadVerification
        fields = {
            "id": ["exact", "in", "range"],
            "shipment": ["exact"],
            "shipment_line": ["exact", "isnull"],
            "warehouse": ["exact"],
            "dock_location": ["exact"],
            "goods": ["exact"],
            "license_plate": ["exact", "isnull"],
            "status": ["exact"],
            "trailer_reference": ["exact", "icontains"],
            "verified_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
