from __future__ import annotations

from rest_framework import serializers

from .models import DistributionProduct, Product, ProductMark, ProductPackaging, ProductSerialConfig


class ProductSerializer(serializers.ModelSerializer):
    organization_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = Product
        fields = (
            "id",
            "organization_id",
            "sku",
            "name",
            "barcode",
            "unit_of_measure",
            "category",
            "brand",
            "description",
            "is_active",
        )
        read_only_fields = ("id", "organization_id")


class DistributionProductSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)
    customer_account_id = serializers.IntegerField()
    customer_account_name = serializers.CharField(source="customer_account.name", read_only=True)
    customer_account_code = serializers.CharField(source="customer_account.code", read_only=True)

    class Meta:
        model = DistributionProduct
        fields = (
            "id",
            "product_id",
            "customer_account_id",
            "customer_account_name",
            "customer_account_code",
            "external_sku",
            "external_name",
            "channel_name",
            "allow_dropshipping_orders",
            "allow_inbound_goods",
            "is_active",
        )
        read_only_fields = ("id", "product_id", "customer_account_name", "customer_account_code")


class ProductSerialConfigSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductSerialConfig
        fields = (
            "id",
            "product_id",
            "tracking_mode",
            "serial_pattern",
            "requires_uniqueness",
            "capture_on_inbound",
            "capture_on_outbound",
            "capture_on_returns",
        )
        read_only_fields = ("id", "product_id")


class ProductPackagingSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductPackaging
        fields = (
            "id",
            "product_id",
            "package_type",
            "package_code",
            "units_per_package",
            "length_cm",
            "width_cm",
            "height_cm",
            "weight_kg",
            "is_default",
            "is_active",
        )
        read_only_fields = ("id", "product_id")


class ProductMarkSerializer(serializers.ModelSerializer):
    product_id = serializers.IntegerField(read_only=True)

    class Meta:
        model = ProductMark
        fields = (
            "id",
            "product_id",
            "mark_type",
            "value",
            "notes",
            "is_active",
        )
        read_only_fields = ("id", "product_id")
