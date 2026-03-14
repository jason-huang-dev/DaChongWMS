"""Serializers for inbound purchasing, receipts, and putaway workflows."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from catalog.goods.models import ListModel as Goods
from inventory.models import InventoryStatus, InventoryMovement
from locations.models import Location
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from utils import datasolve
from warehouse.models import Warehouse

from .models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    AdvanceShipmentNoticeStatus,
    PurchaseOrder,
    PurchaseOrderLine,
    PurchaseOrderStatus,
    PutawayTask,
    PutawayTaskStatus,
    Receipt,
    ReceiptLine,
)


class AdvanceShipmentNoticeLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)

    class Meta:
        model = AdvanceShipmentNoticeLine
        fields = [
            "id",
            "line_number",
            "purchase_order_line",
            "goods",
            "goods_code",
            "expected_qty",
            "received_qty",
            "stock_status",
            "expected_lpn_code",
            "notes",
        ]
        read_only_fields = fields


class AdvanceShipmentNoticeLineWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    purchase_order_line = serializers.PrimaryKeyRelatedField(queryset=PurchaseOrderLine.objects.filter(is_delete=False), required=False, allow_null=True)
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    expected_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    expected_lpn_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")


class AdvanceShipmentNoticeSerializer(serializers.ModelSerializer):
    purchase_order = serializers.PrimaryKeyRelatedField(queryset=PurchaseOrder.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.filter(is_delete=False))
    purchase_order_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.supplier_name", read_only=True)
    asn_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = AdvanceShipmentNoticeLineSerializer(many=True, read_only=True)
    line_items = AdvanceShipmentNoticeLineWriteSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = AdvanceShipmentNotice
        fields = [
            "id",
            "purchase_order",
            "purchase_order_number",
            "warehouse",
            "warehouse_name",
            "supplier",
            "supplier_name",
            "asn_number",
            "expected_arrival_date",
            "status",
            "reference_code",
            "notes",
            "lines",
            "line_items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "purchase_order_number",
            "warehouse_name",
            "supplier_name",
            "lines",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "ASNs require at least one line item"})
        if action in {"update", "partial_update"} and "line_items" in attrs:
            raise serializers.ValidationError({"line_items": "ASN lines cannot be changed through header updates"})
        if action in {"update", "partial_update"} and attrs.get("status") == AdvanceShipmentNoticeStatus.RECEIVED:
            raise serializers.ValidationError({"status": "ASNs close automatically as receipts are posted"})
        return attrs


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = [
            "id",
            "line_number",
            "goods",
            "goods_code",
            "ordered_qty",
            "received_qty",
            "unit_cost",
            "stock_status",
            "status",
        ]
        read_only_fields = fields


class PurchaseOrderLineWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    ordered_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit_cost = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
        required=False,
        default=Decimal("0.0000"),
    )
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)


class PurchaseOrderSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.filter(is_delete=False))
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    supplier_name = serializers.CharField(source="supplier.supplier_name", read_only=True)
    po_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)
    line_items = PurchaseOrderLineWriteSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "supplier",
            "supplier_name",
            "po_number",
            "expected_arrival_date",
            "reference_code",
            "status",
            "notes",
            "lines",
            "line_items",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = ["id", "creator", "openid", "create_time", "update_time", "warehouse_name", "supplier_name", "lines"]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Purchase orders require at least one line item"})
        if action in {"update", "partial_update"} and "line_items" in attrs:
            raise serializers.ValidationError({"line_items": "Purchase order lines cannot be changed through header updates"})
        if action in {"update", "partial_update"} and "po_number" in attrs and self.instance and attrs["po_number"] != self.instance.po_number:
            raise serializers.ValidationError({"po_number": "Purchase order numbers are immutable once created"})
        if action in {"update", "partial_update"} and attrs.get("status") == PurchaseOrderStatus.CLOSED:
            raise serializers.ValidationError({"status": "Purchase orders close automatically when all lines are received"})
        return attrs


class ReceiptLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    purchase_order_line_number = serializers.IntegerField(source="purchase_order_line.line_number", read_only=True)
    asn_line_number = serializers.IntegerField(source="asn_line.line_number", read_only=True)
    license_plate_code = serializers.CharField(source="license_plate.lpn_code", read_only=True)

    class Meta:
        model = ReceiptLine
        fields = [
            "id",
            "purchase_order_line",
            "purchase_order_line_number",
            "asn_line",
            "asn_line_number",
            "goods",
            "goods_code",
            "receipt_location",
            "received_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "unit_cost",
            "inventory_movement",
            "license_plate",
            "license_plate_code",
        ]
        read_only_fields = fields


class ReceiptLineWriteSerializer(serializers.Serializer):
    purchase_order_line = serializers.PrimaryKeyRelatedField(queryset=PurchaseOrderLine.objects.filter(is_delete=False))
    received_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    unit_cost = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
        required=False,
        default=Decimal("0.0000"),
    )


class ReceiptSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    received_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    asn = serializers.PrimaryKeyRelatedField(queryset=AdvanceShipmentNotice.objects.filter(is_delete=False), allow_null=True, required=False)
    purchase_order = serializers.PrimaryKeyRelatedField(queryset=PurchaseOrder.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    receipt_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    receipt_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    asn_number = serializers.CharField(source="asn.asn_number", read_only=True)
    purchase_order_number = serializers.CharField(source="purchase_order.po_number", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    receipt_location_code = serializers.CharField(source="receipt_location.location_code", read_only=True)
    lines = ReceiptLineSerializer(many=True, read_only=True)
    line_items = ReceiptLineWriteSerializer(many=True, write_only=True, required=False)
    received_by = serializers.CharField(read_only=True)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = Receipt
        fields = [
            "id",
            "asn",
            "asn_number",
            "purchase_order",
            "purchase_order_number",
            "warehouse",
            "warehouse_name",
            "receipt_location",
            "receipt_location_code",
            "receipt_number",
            "status",
            "reference_code",
            "notes",
            "lines",
            "line_items",
            "received_by",
            "received_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "status",
            "lines",
            "received_by",
            "received_at",
            "creator",
            "openid",
            "create_time",
            "update_time",
            "purchase_order_number",
            "asn_number",
            "warehouse_name",
            "receipt_location_code",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Receipts require at least one receipt line"})
        return attrs


class PutawayTaskSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)
    from_location_code = serializers.CharField(source="from_location.location_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    receipt_number = serializers.CharField(source="receipt_line.receipt.receipt_number", read_only=True)
    license_plate_code = serializers.CharField(source="license_plate.lpn_code", read_only=True)
    assigned_to = serializers.PrimaryKeyRelatedField(queryset=Staff.objects.filter(is_delete=False), allow_null=True, required=False)
    assigned_to_name = serializers.CharField(source="assigned_to.staff_name", read_only=True)
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    completed_by = serializers.CharField(read_only=True)
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)

    class Meta:
        model = PutawayTask
        fields = [
            "id",
            "receipt_line",
            "receipt_number",
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
            "receipt_line",
            "receipt_number",
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
        if action in {"update", "partial_update"} and attrs.get("status") == PutawayTaskStatus.COMPLETED:
            raise serializers.ValidationError({"status": "Use the complete endpoint to finish putaway tasks"})
        return attrs


class PutawayTaskCompleteSerializer(serializers.Serializer):
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)


class ScanReceiptSerializer(serializers.Serializer):
    purchase_order_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
    asn_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
    receipt_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    receipt_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    goods_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    lpn_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
    attribute_scan = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    received_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.ChoiceField(choices=InventoryStatus.choices, required=False, default=InventoryStatus.AVAILABLE)
    lot_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    serial_number = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    unit_cost = serializers.DecimalField(
        max_digits=18,
        decimal_places=4,
        min_value=Decimal("0.0000"),
        required=False,
        default=Decimal("0.0000"),
    )
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")

    def validate(self, attrs):
        if not attrs.get("purchase_order_number") and not attrs.get("asn_number"):
            raise serializers.ValidationError({"detail": "purchase_order_number or asn_number is required"})
        return attrs


class ScanPutawaySerializer(serializers.Serializer):
    task_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    from_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    to_location_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    goods_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate])
    lpn_barcode = serializers.CharField(max_length=255, validators=[datasolve.data_validate], required=False, allow_blank=True, default="")
