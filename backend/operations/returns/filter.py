from django_filters import FilterSet

from .models import ReturnDisposition, ReturnOrder, ReturnReceipt


class ReturnOrderFilter(FilterSet):
    class Meta:
        model = ReturnOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "customer": ["exact"],
            "sales_order": ["exact", "isnull"],
            "return_number": ["exact", "icontains"],
            "status": ["exact"],
            "requested_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReturnReceiptFilter(FilterSet):
    class Meta:
        model = ReturnReceipt
        fields = {
            "id": ["exact", "in", "range"],
            "return_line": ["exact"],
            "warehouse": ["exact"],
            "receipt_location": ["exact"],
            "receipt_number": ["exact", "icontains"],
            "stock_status": ["exact"],
            "received_by": ["exact", "icontains"],
            "received_at": ["gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReturnDispositionFilter(FilterSet):
    class Meta:
        model = ReturnDisposition
        fields = {
            "id": ["exact", "in", "range"],
            "return_receipt": ["exact"],
            "warehouse": ["exact"],
            "to_location": ["exact", "isnull"],
            "disposition_number": ["exact", "icontains"],
            "disposition_type": ["exact"],
            "completed_by": ["exact", "icontains"],
            "completed_at": ["gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
