from __future__ import annotations

from django.test import TestCase

from apps.organizations.tests.test_factories import make_customer_account, make_organization
from apps.products.services.product_service import (
    CreateDistributionProductInput,
    CreateProductInput,
    CreateProductPackagingInput,
    create_distribution_product,
    create_product,
    create_product_packaging,
    update_product_packaging,
)


class ProductServiceTests(TestCase):
    def test_create_product_normalizes_sku_and_uom(self) -> None:
        product = create_product(
            CreateProductInput(
                organization=make_organization(),
                sku=" sku-001 ",
                name=" Bluetooth Scanner ",
                unit_of_measure=" ea ",
            )
        )

        self.assertEqual(product.sku, "SKU-001")
        self.assertEqual(product.name, "Bluetooth Scanner")
        self.assertEqual(product.unit_of_measure, "EA")

    def test_distribution_product_requires_same_organization_customer(self) -> None:
        organization = make_organization()
        product = create_product(
            CreateProductInput(
                organization=organization,
                sku="SKU-001",
                name="Bluetooth Scanner",
            )
        )

        distribution_product = create_distribution_product(
            CreateDistributionProductInput(
                product=product,
                customer_account=make_customer_account(organization),
                external_sku=" retail-001 ",
            )
        )

        self.assertEqual(distribution_product.external_sku, "RETAIL-001")

    def test_default_packaging_switches_off_previous_default(self) -> None:
        product = create_product(
            CreateProductInput(
                organization=make_organization(),
                sku="SKU-001",
                name="Bluetooth Scanner",
            )
        )
        first_packaging = create_product_packaging(
            CreateProductPackagingInput(
                product=product,
                package_type="CARTON",
                package_code="CTN-1",
                is_default=True,
            )
        )
        second_packaging = create_product_packaging(
            CreateProductPackagingInput(
                product=product,
                package_type="PALLET",
                package_code="PLT-1",
                is_default=True,
            )
        )

        first_packaging.refresh_from_db()
        self.assertFalse(first_packaging.is_default)
        self.assertTrue(second_packaging.is_default)

        update_product_packaging(first_packaging, is_default=True)
        second_packaging.refresh_from_db()
        self.assertTrue(first_packaging.is_default)
        self.assertFalse(second_packaging.is_default)
