"""Serializers for return receipt and disposition workflows."""

from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryMovement, InventoryStatus
from locations.models import Location
from warehouse.models import Warehouse
from utils import datasolve

from .models import (
    ReturnDisposition,
    ReturnDispositionType,
    ReturnLine,
    ReturnLineStatus,
    ReturnOrder,
    ReturnOrderStatus,
    ReturnReceipt,
)
from operations.outbound.models import SalesOrder


class ReturnLineSerializer(serializers.ModelSerializer):
    goods_code = serializers.CharField(source="goods.goods_code", read_only=True)

    class Meta:
        model = ReturnLine
        fields = [
            "id",
            "line_number",
            "goods",
            "goods_code",
            "expected_qty",
            "received_qty",
            "disposed_qty",
            "status",
            "return_reason",
            "notes",
        ]
        read_only_fields = fields


class ReturnLineWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    goods = serializers.PrimaryKeyRelatedField(queryset=Goods.objects.filter(is_delete=False))
    expected_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    return_reason = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False, default="")


class ReturnOrderSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    customer = serializers.PrimaryKeyRelatedField(queryset=Customer.objects.filter(is_delete=False))
    sales_order = serializers.PrimaryKeyRelatedField(queryset=SalesOrder.objects.filter(is_delete=False), allow_null=True, required=False)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    customer_name = serializers.CharField(source="customer.customer_name", read_only=True)
    sales_order_number = serializers.CharField(source="sales_order.order_number", read_only=True)
    return_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    reference_code = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    lines = ReturnLineSerializer(many=True, read_only=True)
    line_items = ReturnLineWriteSerializer(many=True, write_only=True, required=False)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = ReturnOrder
        fields = [
            "id",
            "warehouse",
            "warehouse_name",
            "customer",
            "customer_name",
            "sales_order",
            "sales_order_number",
            "return_number",
            "requested_date",
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
        read_only_fields = [
            "id",
            "warehouse_name",
            "customer_name",
            "sales_order_number",
            "lines",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        action = getattr(self.context.get("view"), "action", None)
        if action == "create" and not attrs.get("line_items"):
            raise serializers.ValidationError({"line_items": "Return orders require at least one line item"})
        if action in {"update", "partial_update"} and "line_items" in attrs:
            raise serializers.ValidationError({"line_items": "Return order lines cannot be changed through header updates"})
        if action in {"update", "partial_update"} and "return_number" in attrs and self.instance and attrs["return_number"] != self.instance.return_number:
            raise serializers.ValidationError({"return_number": "Return numbers are immutable once created"})
        if action in {"update", "partial_update"} and attrs.get("status") in {ReturnOrderStatus.PARTIAL_RECEIVED, ReturnOrderStatus.RECEIVED, ReturnOrderStatus.PARTIAL_DISPOSED, ReturnOrderStatus.COMPLETED}:
            raise serializers.ValidationError({"status": "Return order status is system-managed beyond cancellation"})
        return attrs


class ReturnReceiptSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    received_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    return_line = serializers.PrimaryKeyRelatedField(queryset=ReturnLine.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    receipt_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False))
    receipt_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    return_number = serializers.CharField(source="return_line.return_order.return_number", read_only=True)
    line_number = serializers.IntegerField(source="return_line.line_number", read_only=True)
    goods_code = serializers.CharField(source="return_line.goods.goods_code", read_only=True)
    warehouse_name = serializers.CharField(source="warehouse.warehouse_name", read_only=True)
    receipt_location_code = serializers.CharField(source="receipt_location.location_code", read_only=True)
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)
    received_by = serializers.CharField(read_only=True)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = ReturnReceipt
        fields = [
            "id",
            "return_line",
            "return_number",
            "line_number",
            "goods_code",
            "warehouse",
            "warehouse_name",
            "receipt_location",
            "receipt_location_code",
            "receipt_number",
            "received_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "notes",
            "received_by",
            "received_at",
            "inventory_movement",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "return_number",
            "line_number",
            "goods_code",
            "warehouse_name",
            "receipt_location_code",
            "received_by",
            "received_at",
            "inventory_movement",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]


class ReturnDispositionSerializer(serializers.ModelSerializer):
    create_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    update_time = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    completed_at = serializers.DateTimeField(read_only=True, format="%Y-%m-%d %H:%M:%S")
    return_receipt = serializers.PrimaryKeyRelatedField(queryset=ReturnReceipt.objects.filter(is_delete=False))
    warehouse = serializers.PrimaryKeyRelatedField(queryset=Warehouse.objects.filter(is_delete=False))
    to_location = serializers.PrimaryKeyRelatedField(queryset=Location.objects.filter(is_delete=False), allow_null=True, required=False)
    disposition_number = serializers.CharField(max_length=64, validators=[datasolve.data_validate])
    notes = serializers.CharField(validators=[datasolve.data_validate], allow_blank=True, required=False)
    return_number = serializers.CharField(source="return_receipt.return_line.return_order.return_number", read_only=True)
    receipt_number = serializers.CharField(source="return_receipt.receipt_number", read_only=True)
    goods_code = serializers.CharField(source="return_receipt.return_line.goods.goods_code", read_only=True)
    to_location_code = serializers.CharField(source="to_location.location_code", read_only=True)
    inventory_movement = serializers.PrimaryKeyRelatedField(read_only=True)
    completed_by = serializers.CharField(read_only=True)
    creator = serializers.CharField(read_only=True)

    class Meta:
        model = ReturnDisposition
        fields = [
            "id",
            "return_receipt",
            "return_number",
            "receipt_number",
            "goods_code",
            "warehouse",
            "disposition_number",
            "disposition_type",
            "quantity",
            "to_location",
            "to_location_code",
            "notes",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]
        read_only_fields = [
            "id",
            "return_number",
            "receipt_number",
            "goods_code",
            "to_location_code",
            "completed_by",
            "completed_at",
            "inventory_movement",
            "creator",
            "openid",
            "create_time",
            "update_time",
        ]

    def validate(self, attrs):
        disposition_type = attrs.get("disposition_type")
        to_location = attrs.get("to_location")
        if disposition_type == ReturnDispositionType.SCRAP and to_location is not None:
            raise serializers.ValidationError({"to_location": "Scrap dispositions must not provide a destination location"})
        if disposition_type in {ReturnDispositionType.RESTOCK, ReturnDispositionType.QUARANTINE} and to_location is None:
            raise serializers.ValidationError({"to_location": "A destination location is required for this disposition"})
        return attrs
