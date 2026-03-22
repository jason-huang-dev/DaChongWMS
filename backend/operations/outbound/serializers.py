"""Serializers for outbound sales, picking, and shipment workflows."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryMovement, InventoryStatus
from locations.models import Location
from staff.models import ListModel as Staff
from utils import datasolve
from warehouse.models import Warehouse

from operations.order_types import OperationOrderType

from .models import (
    DockLoadVerification,
    LogisticsTrackingEvent,
    LogisticsTrackingStatus,
    OutboundWave,
    OutboundWaveOrder,
    OutboundWaveStatus,
    PackageExecutionRecord,
    PackageExecutionStatus,
    PackageExecutionStep,
    PickTask,
    PickTaskStatus,
    SalesOrder,
    SalesOrderExceptionState,
    SalesOrderFulfillmentStage,
    SalesOrderLine,
    SalesOrderStatus,
    Shipment,
    ShipmentDocumentRecord,
    ShipmentDocumentType,
    ShipmentLine,
    ShortPickReason,
    ShortPickRecord,
)


class SalesOrderLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)

    class Meta:
        model = SalesOrderLine
        fields = [
            "id",
            "line_number",
            "goods",
            "goods_code",
            "ordered_qty",
            "allocated_qty",
            "picked_qty",
            "shipped_qty",
            "unit_price",
            "stock_status",
            "status",
        ]
        read_only_fields = fields


class SalesOrderLineWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    ordered_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit_price = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
        required=False,
        default=Decimal("0.0000"),
    )
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)


class SalesOrderSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    order_time = serializers.DateTimeField(required=False, allow_null=True, format="%Y-%m-%d %H:%M:%S")
    expires_at = serializers.DateTimeField(required=False, allow_null=True, format="%Y-%m-%d %H:%M:%S")
    waybill_printed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    picking_started_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    picking_completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    packed_at = serializers.DateTimeField(required=False, allow_null=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(is_delete=False))
    staging_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    customer_name = serializers.CharField(source="customer.customer_name", read_only=True)
    staging_location_code = serializers.CharField(source="staging_location.location_code", read_only=True)
    order_type = serializers.ChoiceField(choices=OperationOrderType.choices, required=False, default=OperationOrderType.DROPSHIP)
    order_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    fulfillment_stage = serializers.ChoiceField(choices=SalesOrderFulfillmentStage.choices, read_only=True)
    exception_state = serializers.ChoiceField(
        choices=SalesOrderExceptionState.choices,
        required=False,
        default=SalesOrderExceptionState.NORMAL,
    )
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    package_type = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    logistics_provider = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    shipping_method = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    tracking_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    waybill_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    deliverer_name = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    deliverer_phone = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_name = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_phone = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_country = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_state = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_city = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_address = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    receiver_postal_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    exception_notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    line_items = SalesOrderLineWriteSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = SalesOrder
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "customer",
            "customer_name",
            "staging_location",
            "staging_location_code",
            "order_type",
            "order_number",
            "order_time",
            "requested_ship_date",
            "expires_at",
            "reference_code",
            "status",
            "fulfillment_stage",
            "exception_state",
            "package_count",
            "package_type",
            "package_weight",
            "package_length",
            "package_width",
            "package_height",
            "package_volume",
            "logistics_provider",
            "shipping_method",
            "tracking_number",
            "waybill_number",
            "waybill_printed",
            "waybill_printed_at",
            "deliverer_name",
            "deliverer_phone",
            "receiver_name",
            "receiver_phone",
            "receiver_country",
            "receiver_state",
            "receiver_city",
            "receiver_address",
            "receiver_postal_code",
            "picking_started_at",
            "picking_completed_at",
            "packed_at",
            "exception_notes",
            "notes",
            "lines",
            "line_items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "customer_name",
            "staging_location_code",
            "fulfillment_stage",
            "waybill_printed_at",
            "picking_started_at",
            "picking_completed_at",
            "lines",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Sales orders require at least one line item"})
        if action == "create" and attrs.get("status") not in {None, SalesOrderStatus.OPEN}:
            raise serializers.ValidationError({"status": "Sales orders must start in OPEN status"})
        if action == "create" and attrs.get("packed_at") is not None:
            raise serializers.ValidationError({"packed_at": "Orders cannot be marked packed before picking completes"})
        if action in {"update", "partial_update"} and "line_items" in attrs:
            raise serializers.ValidationError({"line_items": "Sales order lines cannot be changed through header updates"})
        if action in {"update", "partial_update"} and "order_number" in attrs and self.instance and attrs["order_number"] != self.instance.order_number:
            raise serializers.ValidationError({"order_number": "Sales order numbers are immutable once created"})
        if action in {"update", "partial_update"} and "order_type" in attrs and self.instance and attrs["order_type"] != self.instance.order_type:
            raise serializers.ValidationError({"order_type": "Sales order type is immutable once created"})
        if action in {"update", "partial_update"} and attrs.get("status") in {SalesOrderStatus.ALLOCATED, SalesOrderStatus.PICKING, SalesOrderStatus.PICKED, SalesOrderStatus.SHIPPED}:
            raise serializers.ValidationError({"status": "Sales order status is system-managed beyond cancellation"})
        return attrs


class SalesOrderAllocateSerializer(serializers.Serializer):
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)


class PickTaskSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    order_number = serializers.CharField(source="sales_order_line.sales_order.order_number", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    order_type = serializers.CharField(source="sales_order_line.sales_order.order_type", read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)
    assigned_to_name = serializers.CharField(source="assigned_to.staff_name", read_only=True)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    license_plate_code = serializers.CharField(source="license_plate.lpn_code", read_only=True)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    completed_by = serializers.CharField(read_only=True)
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PickTask
        fields = [
            "id",
            "sales_order_line",
            "order_number",
            "order_type",
            "warehouse",
            "warehouse_name",
            "goods",
            "goods_code",
            "task_number",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "quantity",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_to",
            "assigned_to_name",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "license_plate",
            "license_plate_code",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "sales_order_line",
            "order_number",
            "warehouse",
            "warehouse_name",
            "goods",
            "goods_code",
            "task_number",
            "from_location",
            "from_location_code",
            "quantity",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "license_plate",
            "license_plate_code",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action in {"update", "partial_update"} and attrs.get("status") == PickTaskStatus.COMPLETED:
            raise serializers.ValidationError({"status": "Use the complete endpoint to finish pick tasks"})
        return attrs


class PickTaskCompleteSerializer(serializers.Serializer):
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)


class PickTaskShortPickReportSerializer(serializers.Serializer):
    short_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    picked_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), required=False)
    reason_code = serializers.ChoiceField(choices=ShortPickReason.choices)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")


class ShipmentLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    sales_order_line_number = serializers.IntegerField(source="sales_order_line.line_number", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    license_plate_code = serializers.CharField(source="license_plate.lpn_code", read_only=True)

    class Meta:
        model = ShipmentLine
        fields = [
            "id",
            "sales_order_line",
            "sales_order_line_number",
            "goods",
            "goods_code",
            "from_location",
            "from_location_code",
            "shipped_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "inventory_movement",
            "license_plate",
            "license_plate_code",
        ]
        read_only_fields = fields


class ShipmentLineWriteSerializer(serializers.Serializer):
    sales_order_line = serializers.PrimaryKeyRelatedField(queryset=SalesOrderLine.objects.filter(is_delete=False))
    shipped_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    from_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)


class ShipmentSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    shipped_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    sales_order = serializers.PrimaryKeyRelatedField(queryset=SalesOrder.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    staging_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    shipment_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    order_type = serializers.CharField(source="sales_order.order_type", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    staging_location_code = serializers.CharField(source="staging_location.location_code", read_only=True)
    lines = ShipmentLineSerializer(many=True, read_only=True)
    line_items = ShipmentLineWriteSerializer(many=True, write_only=True, required=False)
    shipped_by = serializers.CharField(read_only=True)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = Shipment
        fields = [
            "id",
            "sales_order",
            "order_number",
            "order_type",
            "warehouse",
            "warehouse_name",
            "staging_location",
            "staging_location_code",
            "shipment_number",
            "status",
            "reference_code",
            "notes",
            "lines",
            "line_items",
            "shipped_by",
            "shipped_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "order_number",
            "warehouse_name",
            "staging_location_code",
            "status",
            "lines",
            "shipped_by",
            "shipped_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Shipments require at least one shipment line"})
        return attrs


class OutboundWaveOrderSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    sales_order_status = serializers.CharField(source="sales_order.status", read_only=True)
    fulfillment_stage = serializers.CharField(source="sales_order.fulfillment_stage", read_only=True)
    exception_state = serializers.CharField(source="sales_order.exception_state", read_only=True)

    class Meta:
        model = OutboundWaveOrder
        fields = [
            "id",
            "sales_order",
            "order_number",
            "sort_sequence",
            "sales_order_status",
            "fulfillment_stage",
            "exception_state",
        ]
        read_only_fields = fields


class OutboundWaveSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    generated_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    order_type = serializers.ChoiceField(choices=OperationOrderType.choices, read_only=True)
    wave_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    status = serializers.ChoiceField(choices=OutboundWaveStatus.choices, required=False, default=OutboundWaveStatus.OPEN)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    generated_by = serializers.CharField(read_only=True)
    orders = OutboundWaveOrderSerializer(many=True, read_only=True)
    order_count = serializers.SerializerMethodField()
    sales_order_ids = serializers.PrimaryKeyRelatedField(
        queryset=SalesOrder.objects.filter(is_delete=False),
        many=True,
        write_only=True,
        required=False,
    )

    class Meta:
        model = OutboundWave
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "order_type",
            "wave_number",
            "status",
            "notes",
            "generated_by",
            "generated_at",
            "order_count",
            "orders",
            "sales_order_ids",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "generated_by",
            "generated_at",
            "order_count",
            "orders",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def get_order_count(self, obj: OutboundWave) -> int:
        return obj.orders.filter(is_delete=False).count()

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("sales_order_ids"):
            raise serializers.ValidationError({"sales_order_ids": "Waves require at least one sales order"})
        if action in {"update", "partial_update"} and "sales_order_ids" in attrs:
            raise serializers.ValidationError({"sales_order_ids": "Wave assignments are immutable after creation"})
        return attrs


class PackageExecutionRecordSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    executed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    sales_order = serializers.PrimaryKeyRelatedField(queryset=SalesOrder.objects.filter(is_delete=False))
    shipment = serializers.PrimaryKeyRelatedField(queryset=Shipment.objects.filter(is_delete=False), allow_null=True, required=False)
    wave = serializers.PrimaryKeyRelatedField(queryset=OutboundWave.objects.filter(is_delete=False), allow_null=True, required=False)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    order_type = serializers.CharField(source="sales_order.order_type", read_only=True)
    shipment_number = serializers.CharField(source="shipment.shipment_number", read_only=True)
    wave_number = serializers.CharField(source="wave.wave_number", read_only=True)
    record_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    step_type = serializers.ChoiceField(choices=PackageExecutionStep.choices)
    execution_status = serializers.ChoiceField(
        choices=PackageExecutionStatus.choices,
        required=False,
        default=PackageExecutionStatus.SUCCESS,
    )
    package_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    scan_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    weight = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), allow_null=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    requested_order_type = serializers.ChoiceField(
        choices=OperationOrderType.choices,
        write_only=True,
        required=False,
        allow_blank=True,
        default="",
    )
    executed_by = serializers.CharField(read_only=True)

    class Meta:
        model = PackageExecutionRecord
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "sales_order",
            "order_number",
            "order_type",
            "shipment",
            "shipment_number",
            "wave",
            "wave_number",
            "record_number",
            "step_type",
            "execution_status",
            "package_number",
            "scan_code",
            "weight",
            "notes",
            "requested_order_type",
            "executed_by",
            "executed_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "order_number",
            "shipment_number",
            "wave_number",
            "executed_by",
            "executed_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class ShipmentDocumentRecordSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    generated_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    sales_order = serializers.PrimaryKeyRelatedField(queryset=SalesOrder.objects.filter(is_delete=False))
    shipment = serializers.PrimaryKeyRelatedField(queryset=Shipment.objects.filter(is_delete=False), allow_null=True, required=False)
    wave = serializers.PrimaryKeyRelatedField(queryset=OutboundWave.objects.filter(is_delete=False), allow_null=True, required=False)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    order_type = serializers.CharField(source="sales_order.order_type", read_only=True)
    shipment_number = serializers.CharField(source="shipment.shipment_number", read_only=True)
    wave_number = serializers.CharField(source="wave.wave_number", read_only=True)
    document_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    document_type = serializers.ChoiceField(choices=ShipmentDocumentType.choices)
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    file_name = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    generated_by = serializers.CharField(read_only=True)

    class Meta:
        model = ShipmentDocumentRecord
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "sales_order",
            "order_number",
            "order_type",
            "shipment",
            "shipment_number",
            "wave",
            "wave_number",
            "document_number",
            "document_type",
            "reference_code",
            "file_name",
            "notes",
            "generated_by",
            "generated_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "order_number",
            "shipment_number",
            "wave_number",
            "generated_by",
            "generated_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class LogisticsTrackingEventSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    occurred_at = serializers.DateTimeField(required=False, allow_null=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    sales_order = serializers.PrimaryKeyRelatedField(queryset=SalesOrder.objects.filter(is_delete=False))
    shipment = serializers.PrimaryKeyRelatedField(queryset=Shipment.objects.filter(is_delete=False), allow_null=True, required=False)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    order_type = serializers.CharField(source="sales_order.order_type", read_only=True)
    shipment_number = serializers.CharField(source="shipment.shipment_number", read_only=True)
    event_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    tracking_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    event_code = serializers.CharField(max_length=32, validators=[datasolve.data_validate])
    event_status = serializers.ChoiceField(choices=LogisticsTrackingStatus.choices)
    event_location = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    description = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    recorded_by = serializers.CharField(read_only=True)

    class Meta:
        model = LogisticsTrackingEvent
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "sales_order",
            "order_number",
            "order_type",
            "shipment",
            "shipment_number",
            "event_number",
            "tracking_number",
            "event_code",
            "event_status",
            "event_location",
            "description",
            "occurred_at",
            "recorded_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "warehouse_name",
            "order_number",
            "order_type",
            "shipment_number",
            "recorded_by",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class ScanPickSerializer(serializers.Serializer):
    task_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    from_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    goods_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    to_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    lpn_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")


class ScanShipmentSerializer(serializers.Serializer):
    sales_order_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    shipment_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    staging_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    goods_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    dock_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
    lpn_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
    attribute_scan = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    shipped_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    trailer_reference = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")


class DockLoadVerificationSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    shipment_number = serializers.CharField(source="shipment.shipment_number", read_only=True)
    dock_location_code = serializers.CharField(source="dock_location.location_code", read_only=True)
    license_plate_code = serializers.CharField(source="license_plate.lpn_code", read_only=True)

    class Meta:
        model = DockLoadVerification
        fields = [
            "id",
            "shipment",
            "shipment_number",
            "shipment_line",
            "warehouse",
            "dock_location",
            "dock_location_code",
            "goods",
            "goods_code",
            "license_plate",
            "license_plate_code",
            "verified_qty",
            "status",
            "trailer_reference",
            "verified_by",
            "verified_at",
            "notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class ShortPickRecordSerializer(serializers.ModelSerializer):
    order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    reported_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    resolved_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")

    class Meta:
        model = ShortPickRecord
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "sales_order",
            "order_number",
            "sales_order_line",
            "pick_task",
            "goods",
            "goods_code",
            "from_location",
            "from_location_code",
            "to_location",
            "to_location_code",
            "requested_qty",
            "picked_qty",
            "short_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "reason_code",
            "status",
            "notes",
            "reported_by",
            "reported_at",
            "resolved_by",
            "resolved_at",
            "resolution_notes",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = fields


class ShortPickResolveSerializer(serializers.Serializer):
    resolution_notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
