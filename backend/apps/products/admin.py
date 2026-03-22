from django.contrib import admin

from .models import (
    DistributionProduct,
    Product,
    ProductMark,
    ProductPackaging,
    ProductSerialConfig,
)


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("organization", "sku", "name", "unit_of_measure", "brand", "is_active")
    search_fields = ("sku", "name", "barcode", "brand", "category", "organization__name")
    list_filter = ("is_active",)


@admin.register(DistributionProduct)
class DistributionProductAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "customer_account",
        "external_sku",
        "channel_name",
        "allow_dropshipping_orders",
        "allow_inbound_goods",
        "is_active",
    )
    search_fields = (
        "product__sku",
        "product__name",
        "customer_account__code",
        "customer_account__name",
        "external_sku",
        "external_name",
        "channel_name",
    )
    list_filter = ("is_active", "allow_dropshipping_orders", "allow_inbound_goods")


@admin.register(ProductSerialConfig)
class ProductSerialConfigAdmin(admin.ModelAdmin):
    list_display = (
        "product",
        "tracking_mode",
        "requires_uniqueness",
        "capture_on_inbound",
        "capture_on_outbound",
        "capture_on_returns",
    )
    search_fields = ("product__sku", "product__name", "serial_pattern")
    list_filter = ("tracking_mode", "requires_uniqueness", "capture_on_inbound", "capture_on_outbound")


@admin.register(ProductPackaging)
class ProductPackagingAdmin(admin.ModelAdmin):
    list_display = ("product", "package_code", "package_type", "units_per_package", "is_default", "is_active")
    search_fields = ("product__sku", "product__name", "package_code")
    list_filter = ("package_type", "is_default", "is_active")


@admin.register(ProductMark)
class ProductMarkAdmin(admin.ModelAdmin):
    list_display = ("product", "mark_type", "value", "is_active")
    search_fields = ("product__sku", "product__name", "value", "notes")
    list_filter = ("mark_type", "is_active")
