from django_filters import CharFilter, FilterSet

from .models import (
    DockLoadVerification,
    LogisticsTrackingEvent,
    OutboundWave,
    PackageExecutionRecord,
    PickTask,
    SalesOrder,
    Shipment,
    ShipmentDocumentRecord,
    ShortPickRecord,
)


class SalesOrderFilter(FilterSet):
    order_type = CharFilter(field_name="order_type")

    class Meta:
        model = SalesOrder
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "customer": ["exact"],
            "staging_location": ["exact"],
            "order_type": ["exact", "in"],
            "order_number": ["exact", "icontains"],
            "status": ["exact", "in"],
            "fulfillment_stage": ["exact"],
            "exception_state": ["exact"],
            "tracking_number": ["exact", "icontains"],
            "waybill_number": ["exact", "icontains"],
            "waybill_printed": ["exact"],
            "shipping_method": ["exact", "icontains"],
            "logistics_provider": ["exact", "icontains"],
            "order_time": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "requested_ship_date": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "expires_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PickTaskFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order_line__sales_order__order_type")

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
            "status": ["exact", "in"],
            "assigned_to": ["exact", "isnull"],
            "completed_at": ["gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ShipmentFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order__order_type")

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


class OutboundWaveFilter(FilterSet):
    order_type = CharFilter(field_name="order_type")

    class Meta:
        model = OutboundWave
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "order_type": ["exact", "in"],
            "wave_number": ["exact", "icontains"],
            "status": ["exact"],
            "generated_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class PackageExecutionRecordFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order__order_type")

    class Meta:
        model = PackageExecutionRecord
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "sales_order": ["exact"],
            "shipment": ["exact", "isnull"],
            "wave": ["exact", "isnull"],
            "record_number": ["exact", "icontains"],
            "step_type": ["exact"],
            "execution_status": ["exact"],
            "package_number": ["exact", "icontains"],
            "executed_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class ShipmentDocumentRecordFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order__order_type")

    class Meta:
        model = ShipmentDocumentRecord
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "sales_order": ["exact"],
            "shipment": ["exact", "isnull"],
            "wave": ["exact", "isnull"],
            "document_number": ["exact", "icontains"],
            "document_type": ["exact"],
            "reference_code": ["exact", "icontains"],
            "generated_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class DockLoadVerificationFilter(FilterSet):
    order_type = CharFilter(field_name="shipment__sales_order__order_type")

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


class ShortPickRecordFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order__order_type")

    class Meta:
        model = ShortPickRecord
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "sales_order": ["exact"],
            "sales_order_line": ["exact"],
            "pick_task": ["exact"],
            "goods": ["exact"],
            "from_location": ["exact"],
            "to_location": ["exact", "isnull"],
            "status": ["exact"],
            "reason_code": ["exact"],
            "reported_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "resolved_at": ["exact", "gt", "gte", "lt", "lte", "range", "isnull"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }


class LogisticsTrackingEventFilter(FilterSet):
    order_type = CharFilter(field_name="sales_order__order_type")

    class Meta:
        model = LogisticsTrackingEvent
        fields = {
            "id": ["exact", "in", "range"],
            "warehouse": ["exact"],
            "sales_order": ["exact"],
            "shipment": ["exact", "isnull"],
            "event_number": ["exact", "icontains"],
            "tracking_number": ["exact", "icontains"],
            "event_code": ["exact", "icontains"],
            "event_status": ["exact"],
            "occurred_at": ["exact", "gt", "gte", "lt", "lte", "range"],
            "create_time": ["gt", "gte", "lt", "lte", "range"],
        }
