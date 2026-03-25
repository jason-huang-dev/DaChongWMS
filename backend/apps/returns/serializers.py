from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.returns.models import ReturnDisposition, ReturnLine, ReturnOrder, ReturnReceipt


class ReturnLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    product_id = serializers.IntegerField()
    expected_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    return_reason = serializers.CharField(required=False, allow_blank=True, default="")
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class ReturnLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    return_order_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ReturnLine
        fields = (
            "id",
            "organization_id",
            "return_order_id",
            "line_number",
            "product_id",
            "expected_qty",
            "received_qty",
            "disposed_qty",
            "return_reason",
            "notes",
            "status",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class ReturnOrderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    customer_account_id = serializers.IntegerField()
    sales_order_id = serializers.IntegerField(required=False, allow_null=True)
    line_items = ReturnLineInputSerializer(many=True, write_only=True, required=False)
    lines = ReturnLineSerializer(many=True, read_only=True)

    class Meta:
        model = ReturnOrder
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "customer_account_id",
            "sales_order_id",
            "order_type",
            "return_number",
            "customer_code",
            "customer_name",
            "customer_contact_name",
            "customer_contact_email",
            "customer_contact_phone",
            "requested_date",
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
            "customer_contact_name",
            "customer_contact_email",
            "customer_contact_phone",
            "status",
            "lines",
            "create_time",
            "update_time",
        )


class ReturnReceiptSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    return_line_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    receipt_location_id = serializers.IntegerField()
    inventory_movement_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = ReturnReceipt
        fields = (
            "id",
            "organization_id",
            "return_line_id",
            "warehouse_id",
            "receipt_location_id",
            "receipt_number",
            "received_qty",
            "disposed_qty",
            "stock_status",
            "lot_number",
            "serial_number",
            "notes",
            "received_by",
            "received_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "disposed_qty",
            "received_by",
            "received_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )


class ReturnDispositionSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    return_receipt_id = serializers.IntegerField()
    warehouse_id = serializers.IntegerField()
    to_location_id = serializers.IntegerField(required=False, allow_null=True)
    inventory_movement_id = serializers.IntegerField(read_only=True, allow_null=True)

    class Meta:
        model = ReturnDisposition
        fields = (
            "id",
            "organization_id",
            "return_receipt_id",
            "warehouse_id",
            "disposition_number",
            "disposition_type",
            "quantity",
            "to_location_id",
            "notes",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "completed_by",
            "completed_at",
            "inventory_movement_id",
            "create_time",
            "update_time",
        )

