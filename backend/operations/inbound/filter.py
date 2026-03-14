from django_filters import FilterSet

from .models import AdvanceShipmentNotice, PurchaseOrder, PutawayTask, Receipt


class AdvanceShipmentNoticeFilter(FilterSet):
    class Meta:
        model = AdvanceShipmentNotice
        fields = {
            "id": ["exact", "in", "range"],
            "purchase_order": ["exact"],
            "warehouse": ["exact"],
            "supplier": ["exact"],
            "asn_number": ["exact", "icontains"],
            "status": ["exact"],
            "expected_arrival_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PurchaseOrderFilter(FilterSet):
    class Meta:
        model = PurchaseOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "supplier": ["exact"],
            "po_number": ["exact", "icontains"],
            "status": ["exact"],
            "expected_arrival_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReceiptFilter(FilterSet):
    class Meta:
        model = Receipt
        fields = {
            "id": ["exact", "in", "range"],
            "purchase_order": ["exact"],
            "warehouse": ["exact"],
            "receipt_location": ["exact"],
            "receipt_number": ["exact", "icontains"],
            "status": ["exact"],
            "received_by": ["exact", "icontains"],
            "received_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PutawayTaskFilter(FilterSet):
    class Meta:
        model = PutawayTask
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "goods": ["exact"],
            "receipt_line": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact", "isnull"],
            "task_number": ["exact", "icontains"],
            "status": ["exact"],
            "assigned_to": ["exact", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
