from __future__ import annotations

from decimal import Decimal

from rest_framework import serializers

from apps.outbound.models import PickTask, SalesOrder, SalesOrderLine, Shipment, ShipmentLine


class SalesOrderLineInputSerializer(serializers.Serializer):
    line_number = serializers.IntegerField(min_value=1)
    product_id = serializers.IntegerField()
    ordered_qty = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0001"))
    unit_price = serializers.DecimalField(max_digits=18, decimal_places=4, min_value=Decimal("0.0000"), required=False, default=Decimal("0.0000"))
    stock_status = serializers.CharField(required=False, default="AVAILABLE")


class SalesOrderLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    sales_order_id = serializers.IntegerField(read_only=True)
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = SalesOrderLine
        fields = (
            "id",
            "organization_id",
            "sales_order_id",
            "line_number",
            "product_id",
            "ordered_qty",
            "allocated_qty",
            "picked_qty",
            "shipped_qty",
            "unit_price",
            "stock_status",
            "status",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class SalesOrderSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField()
    customer_account_id = serializers.IntegerField()
    staging_location_id = serializers.IntegerField()
    lines = SalesOrderLineSerializer(many=True, read_only=True)
    line_items = SalesOrderLineInputSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = SalesOrder
        fields = (
            "id",
            "organization_id",
            "warehouse_id",
            "customer_account_id",
            "staging_location_id",
            "order_type",
            "order_number",
            "order_time",
            "requested_ship_date",
            "expires_at",
            "reference_code",
            "status",
            "fulfillment_stage",
            "exception_state",
            "customer_code",
            "customer_name",
            "customer_contact_name",
            "customer_contact_email",
            "customer_contact_phone",
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
            "line_items",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = (
            "id",
            "organization_id",
            "status",
            "fulfillment_stage",
            "customer_code",
            "customer_name",
            "customer_contact_name",
            "customer_contact_email",
            "customer_contact_phone",
            "waybill_printed_at",
            "picking_started_at",
            "picking_completed_at",
            "lines",
            "create_time",
            "update_time",
        )


class PickTaskSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    sales_order_line_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(read_only=True)
    from_location_id = serializers.IntegerField(read_only=True)
    to_location_id = serializers.IntegerField(required=False)
    assigned_membership_id = serializers.IntegerField(required=False, allow_null=True)
    inventory_movement_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = PickTask
        fields = (
            "id",
            "organization_id",
            "sales_order_line_id",
            "warehouse_id",
            "from_location_id",
            "to_location_id",
            "task_number",
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
            "sales_order_line_id",
            "warehouse_id",
            "from_location_id",
            "task_number",
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


class PickTaskCompleteSerializer(serializers.Serializer):
    to_location_id = serializers.IntegerField(required=False)


class ShipmentLineSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    shipment_id = serializers.IntegerField(read_only=True)
    sales_order_line_id = serializers.IntegerField(read_only=True)
    inventory_movement_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ShipmentLine
        fields = ("id", "organization_id", "shipment_id", "sales_order_line_id", "quantity", "inventory_movement_id", "create_time")
        read_only_fields = fields


class ShipmentSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)
    sales_order_id = serializers.IntegerField(read_only=True)
    warehouse_id = serializers.IntegerField(read_only=True)
    lines = ShipmentLineSerializer(many=True, read_only=True)

    class Meta:
        model = Shipment
        fields = (
            "id",
            "organization_id",
            "sales_order_id",
            "warehouse_id",
            "shipment_number",
            "status",
            "tracking_number",
            "shipped_by",
            "shipped_at",
            "lines",
            "create_time",
            "update_time",
        )
        read_only_fields = fields


class ShipmentCreateSerializer(serializers.Serializer):
    shipment_number = serializers.CharField()

