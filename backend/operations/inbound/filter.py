from django_filters import CharFilter, FilterSet

from .models import AdvanceShipmentNotice, InboundImportBatch, InboundSigningRecord, PurchaseOrder, PutawayTask, Receipt


class AdvanceShipmentNoticeFilter(FilterSet):
    order_type = CharFilter(field_name="order_type")

    class Meta:
        model = AdvanceShipmentNotice
        fields = {
            "id": ["exact", "in", "range"],
            "purchase_order": ["exact"],
            "warehouse": ["exact"],
            "supplier": ["exact"],
            "order_type": ["exact", "in"],
            "asn_number": ["exact", "icontains"],
            "status": ["exact", "in"],
            "expected_arrival_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PurchaseOrderFilter(FilterSet):
    order_type = CharFilter(field_name="order_type")

    class Meta:
        model = PurchaseOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "supplier": ["exact"],
            "order_type": ["exact", "in"],
            "po_number": ["exact", "icontains"],
            "status": ["exact", "in"],
            "expected_arrival_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ReceiptFilter(FilterSet):
    order_type = CharFilter(field_name="purchase_order__order_type")

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
    order_type = CharFilter(field_name="receipt_line__receipt__purchase_order__order_type")

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
            "status": ["exact", "in"],
            "assigned_to": ["exact", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class InboundSigningRecordFilter(FilterSet):
    order_type = CharFilter(field_name="purchase_order__order_type")

    class Meta:
        model = InboundSigningRecord
        fields = {
            "id": ["exact", "in", "range"],
            "asn": ["exact", "isnull"],
            "purchase_order": ["exact"],
            "warehouse": ["exact"],
            "signing_number": ["exact", "icontains"],
            "carrier_name": ["exact", "icontains"],
            "vehicle_plate": ["exact", "icontains"],
            "signed_by": ["exact", "icontains"],
            "signed_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class InboundImportBatchFilter(FilterSet):
    class Meta:
        model = InboundImportBatch
        fields = {
            "id": ["exact", "in", "range"],
            "batch_number": ["exact", "icontains"],
            "file_name": ["exact", "icontains"],
            "status": ["exact", "in"],
            "imported_by": ["exact", "icontains"],
            "imported_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
