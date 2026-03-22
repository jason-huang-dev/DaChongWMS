from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal

from apps.organizations.models import Organization
from apps.partners.models import CustomerAccount
from apps.products.models import DistributionProduct, Product, ProductMark, ProductPackaging, ProductSerialConfig


@dataclass(frozen=True, slots=True)
class CreateProductInput:
    organization: Organization
    sku: str
    name: str
    barcode: str = ""
    unit_of_measure: str = "EA"
    category: str = ""
    brand: str = ""
    description: str = ""
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateDistributionProductInput:
    product: Product
    customer_account: CustomerAccount
    external_sku: str
    external_name: str = ""
    channel_name: str = ""
    allow_dropshipping_orders: bool = True
    allow_inbound_goods: bool = True
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class UpsertProductSerialConfigInput:
    product: Product
    tracking_mode: str | None = None
    serial_pattern: str | None = None
    requires_uniqueness: bool | None = None
    capture_on_inbound: bool | None = None
    capture_on_outbound: bool | None = None
    capture_on_returns: bool | None = None


@dataclass(frozen=True, slots=True)
class CreateProductPackagingInput:
    product: Product
    package_type: str
    package_code: str
    units_per_package: int = 1
    length_cm: Decimal = Decimal("0.00")
    width_cm: Decimal = Decimal("0.00")
    height_cm: Decimal = Decimal("0.00")
    weight_kg: Decimal = Decimal("0.00")
    is_default: bool = False
    is_active: bool = True


@dataclass(frozen=True, slots=True)
class CreateProductMarkInput:
    product: Product
    mark_type: str
    value: str
    notes: str = ""
    is_active: bool = True


def list_organization_products(*, organization: Organization) -> list[Product]:
    return list(Product.objects.filter(organization=organization).order_by("sku", "id"))


def create_product(payload: CreateProductInput) -> Product:
    product = Product(
        organization=payload.organization,
        sku=payload.sku,
        name=payload.name,
        barcode=payload.barcode,
        unit_of_measure=payload.unit_of_measure,
        category=payload.category,
        brand=payload.brand,
        description=payload.description,
        is_active=payload.is_active,
    )
    product.save()
    return product


def update_product(
    product: Product,
    *,
    sku: str | None = None,
    name: str | None = None,
    barcode: str | None = None,
    unit_of_measure: str | None = None,
    category: str | None = None,
    brand: str | None = None,
    description: str | None = None,
    is_active: bool | None = None,
) -> Product:
    if sku is not None:
        product.sku = sku
    if name is not None:
        product.name = name
    if barcode is not None:
        product.barcode = barcode
    if unit_of_measure is not None:
        product.unit_of_measure = unit_of_measure
    if category is not None:
        product.category = category
    if brand is not None:
        product.brand = brand
    if description is not None:
        product.description = description
    if is_active is not None:
        product.is_active = is_active
    product.save()
    return product


def list_distribution_products(*, product: Product) -> list[DistributionProduct]:
    return list(
        DistributionProduct.objects.select_related("customer_account")
        .filter(product=product)
        .order_by("customer_account__name", "external_sku", "id")
    )


def create_distribution_product(payload: CreateDistributionProductInput) -> DistributionProduct:
    distribution_product = DistributionProduct(
        product=payload.product,
        customer_account=payload.customer_account,
        external_sku=payload.external_sku,
        external_name=payload.external_name,
        channel_name=payload.channel_name,
        allow_dropshipping_orders=payload.allow_dropshipping_orders,
        allow_inbound_goods=payload.allow_inbound_goods,
        is_active=payload.is_active,
    )
    distribution_product.save()
    return distribution_product


def update_distribution_product(
    distribution_product: DistributionProduct,
    *,
    customer_account: CustomerAccount | None = None,
    external_sku: str | None = None,
    external_name: str | None = None,
    channel_name: str | None = None,
    allow_dropshipping_orders: bool | None = None,
    allow_inbound_goods: bool | None = None,
    is_active: bool | None = None,
) -> DistributionProduct:
    if customer_account is not None:
        distribution_product.customer_account = customer_account
    if external_sku is not None:
        distribution_product.external_sku = external_sku
    if external_name is not None:
        distribution_product.external_name = external_name
    if channel_name is not None:
        distribution_product.channel_name = channel_name
    if allow_dropshipping_orders is not None:
        distribution_product.allow_dropshipping_orders = allow_dropshipping_orders
    if allow_inbound_goods is not None:
        distribution_product.allow_inbound_goods = allow_inbound_goods
    if is_active is not None:
        distribution_product.is_active = is_active
    distribution_product.save()
    return distribution_product


def upsert_product_serial_config(payload: UpsertProductSerialConfigInput) -> ProductSerialConfig:
    config, _ = ProductSerialConfig.objects.get_or_create(product=payload.product)

    if payload.tracking_mode is not None:
        config.tracking_mode = payload.tracking_mode
    if payload.serial_pattern is not None:
        config.serial_pattern = payload.serial_pattern
    if payload.requires_uniqueness is not None:
        config.requires_uniqueness = payload.requires_uniqueness
    if payload.capture_on_inbound is not None:
        config.capture_on_inbound = payload.capture_on_inbound
    if payload.capture_on_outbound is not None:
        config.capture_on_outbound = payload.capture_on_outbound
    if payload.capture_on_returns is not None:
        config.capture_on_returns = payload.capture_on_returns

    config.save()
    return config


def _clear_other_default_packaging(packaging: ProductPackaging) -> None:
    if packaging.is_default:
        ProductPackaging.objects.filter(product=packaging.product).exclude(pk=packaging.pk).update(is_default=False)


def list_product_packaging(*, product: Product) -> list[ProductPackaging]:
    return list(product.packaging_options.order_by("-is_default", "package_code", "id"))


def create_product_packaging(payload: CreateProductPackagingInput) -> ProductPackaging:
    packaging = ProductPackaging(
        product=payload.product,
        package_type=payload.package_type,
        package_code=payload.package_code,
        units_per_package=payload.units_per_package,
        length_cm=payload.length_cm,
        width_cm=payload.width_cm,
        height_cm=payload.height_cm,
        weight_kg=payload.weight_kg,
        is_default=payload.is_default,
        is_active=payload.is_active,
    )
    packaging.save()
    _clear_other_default_packaging(packaging)
    return packaging


def update_product_packaging(
    packaging: ProductPackaging,
    *,
    package_type: str | None = None,
    package_code: str | None = None,
    units_per_package: int | None = None,
    length_cm: Decimal | None = None,
    width_cm: Decimal | None = None,
    height_cm: Decimal | None = None,
    weight_kg: Decimal | None = None,
    is_default: bool | None = None,
    is_active: bool | None = None,
) -> ProductPackaging:
    if package_type is not None:
        packaging.package_type = package_type
    if package_code is not None:
        packaging.package_code = package_code
    if units_per_package is not None:
        packaging.units_per_package = units_per_package
    if length_cm is not None:
        packaging.length_cm = length_cm
    if width_cm is not None:
        packaging.width_cm = width_cm
    if height_cm is not None:
        packaging.height_cm = height_cm
    if weight_kg is not None:
        packaging.weight_kg = weight_kg
    if is_default is not None:
        packaging.is_default = is_default
    if is_active is not None:
        packaging.is_active = is_active
    packaging.save()
    _clear_other_default_packaging(packaging)
    return packaging


def list_product_marks(*, product: Product) -> list[ProductMark]:
    return list(product.marks.order_by("mark_type", "value", "id"))


def create_product_mark(payload: CreateProductMarkInput) -> ProductMark:
    mark = ProductMark(
        product=payload.product,
        mark_type=payload.mark_type,
        value=payload.value,
        notes=payload.notes,
        is_active=payload.is_active,
    )
    mark.save()
    return mark


def update_product_mark(
    mark: ProductMark,
    *,
    mark_type: str | None = None,
    value: str | None = None,
    notes: str | None = None,
    is_active: bool | None = None,
) -> ProductMark:
    if mark_type is not None:
        mark.mark_type = mark_type
    if value is not None:
        mark.value = value
    if notes is not None:
        mark.notes = notes
    if is_active is not None:
        mark.is_active = is_active
    mark.save()
    return mark
