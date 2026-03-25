from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.inbound.models import (
    AdvanceShipmentNotice,
    AdvanceShipmentNoticeLine,
    PurchaseOrder,
    PurchaseOrderLine,
    PutawayTask,
    Receipt,
    ReceiptLine,
)


class PurchaseOrderLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    product_id = serializers.IntegerField()
    ordered_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit_cost = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), required=False, default=Decimal("0.0000"))
    stock_status = serializers.CharField(required=False, default="AVAILABLE")


class PurchaseOrderLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    purchase_order_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = PurchaseOrderLine
        fields = (
            "id",
            "organization_id",
            "purchase_order_id",
            "line_number",
            "product_id",
            "ordered_qty",
            "received_qty",
            "unit_cost",
            "stock_status",
            "status",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class PurchaseOrderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    customer_account_id = serializers.IntegerField()
    line_items = PurchaseOrderLineInputSerializer(many=True, write_only=True, required=False)
    lines = PurchaseOrderLineSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "customer_account_id",
            "order_type",
            "po_number",
            "customer_code",
            "customer_name",
            "supplier_code",
            "supplier_name",
            "supplier_contact_name",
            "supplier_contact_phone",
            "expected_arrival_date",
            "reference_code",
            "status",
            "notes",
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "customer_code",
            "customer_name",
            "status",
            "lines",
            "create_time",
            "update_time",
        )


class AdvanceShipmentNoticeLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    purchase_order_line_id = serializers.IntegerField()
    expected_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.CharField(required=False, default="AVAILABLE")
    expected_lpn_code = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class AdvanceShipmentNoticeLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    asn_id = serializers.IntegerField(read_only=True)
    purchase_order_line_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = AdvanceShipmentNoticeLine
        fields = (
            "id",
            "organization_id",
            "asn_id",
            "line_number",
            "purchase_order_line_id",
            "product_id",
            "expected_qty",
            "received_qty",
            "stock_status",
            "expected_lpn_code",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class AdvanceShipmentNoticeSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    purchase_order_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField(read_only=True)
    customer_account_id = serializers.IntegerField(read_only=True)
    line_items = AdvanceShipmentNoticeLineInputSerializer(many=True, write_only=True, required=False)
    lines = AdvanceShipmentNoticeLineSerializer(many=True, read_only=True)

    class Meta:
        model = AdvanceShipmentNotice
        fields = (
            "id",
            "organization_id",
            "purchase_order_id",
            "warehouse_id",
            "customer_account_id",
            "order_type",
            "asn_number",
            "expected_arrival_date",
            "status",
            "reference_code",
            "notes",
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "customer_account_id",
            "order_type",
            "status",
            "lines",
            "create_time",
            "update_time",
        )


class ReceiptLineInputSerializer(serializers.Serializer):
    purchase_order_line_id = serializers.IntegerField()
    asn_line_id = serializers.IntegerField(required=False, allow_null=True)
    received_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    stock_status = serializers.CharField(required=False, default="AVAILABLE")
    lot_number = serializers.CharField(required=False, allow_blank=True, default="")
    serial_number = serializers.CharField(required=False, allow_blank=True, default="")
    unit_cost = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), required=False, default=Decimal("0.0000"))


class ReceiptLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    asn_line_id = serializers.IntegerField(read_only=True, allow_null=True)
    receipt_id = serializers.IntegerField(read_only=True)
    purchase_order_line_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    receipt_location_id = serializers.IntegerField(read_only=True)
    inventory_movement_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = ReceiptLine
        fields = (
            "id",
            "organization_id",
            "asn_line_id",
            "receipt_id",
            "purchase_order_line_id",
            "product_id",
            "receipt_location_id",
            "received_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "unit_cost",
            "inventory_movement_id",
            "create_time",
        )
        read_only_fields = fields


class ReceiptSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    asn_id = serializers.IntegerField(required=False, allow_null=True)
    purchase_order_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    receipt_location_id = serializers.IntegerField()
    line_items = ReceiptLineInputSerializer(many=True, write_only=True, required=False)
    lines = ReceiptLineSerializer(many=True, read_only=True)

    class Meta:
        model = Receipt
        fields = (
            "id",
            "organization_id",
            "asn_id",
            "purchase_order_id",
            "warehouse_id",
            "receipt_location_id",
            "receipt_number",
            "status",
            "reference_code",
            "notes",
            "received_by",
            "received_at",
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "status",
            "received_by",
            "received_at",
            "lines",
            "create_time",
            "update_time",
        )


class PutawayTaskSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    receipt_line_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)
    from_location_id = serializers.IntegerField(read_only=True)
    to_location_id = serializers.IntegerField(required=False, allow_null=True)
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    inventory_movement_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = PutawayTask
        fields = (
            "id",
            "organization_id",
            "receipt_line_id",
            "warehouse_id",
            "product_id",
            "task_number",
            "from_location_id",
            "to_location_id",
            "quantity",
            "stock_status",
            "lot_number",
            "serial_number",
            "status",
            "assigned_membership_id",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "notes",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "receipt_line_id",
            "warehouse_id",
            "product_id",
            "task_number",
            "from_location_id",
            "quantity",
            "stock_status",
            "lot_number",
            "serial_number",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )


class PutawayTaskCompleteSerializer(serializers.Serializer):
    to_location_id = serializers.IntegerField(required=False)

