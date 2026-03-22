from __future__ import annotations

from django.contrib.auth.models import Permission
from django.test import TestCase
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_customer_account,
    make_organization,
    make_role,
    make_user,
)
from apps.products.models import Product


class ProductAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.viewer = make_user("viewer@example.com")

        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        manager_permissions = (
            "view_product",
            "manage_products",
            "manage_distribution_products",
            "manage_serial_management",
            "manage_packaging",
            "manage_product_marks",
        )
        for codename in manager_permissions:
            permission = Permission.objects.get(
                content_type__app_label="products",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="products",
            codename="view_product",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def test_manager_can_create_product_and_subresources(self) -> None:
        self.client.force_authenticate(self.manager)

        product_response = self.client.post(
            reverse(
                "organization-product-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "sku": "sku-001",
                "name": "Bluetooth Scanner",
                "barcode": "1234567890",
                "unit_of_measure": "ea",
                "category": "Devices",
                "brand": "DaChong",
                "description": "Handheld scanner",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(product_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(product_response.data["sku"], "SKU-001")
        product_id = product_response.data["id"]

        customer_account = make_customer_account(self.organization, name="Retail Client", code="RTL-1")

        distribution_response = self.client.post(
            reverse(
                "organization-distribution-product-list",
                kwargs={"organization_id": self.organization.id, "product_id": product_id},
            ),
            {
                "customer_account_id": customer_account.id,
                "external_sku": "retail-sku",
                "external_name": "Retail Scanner",
                "channel_name": "Shopify",
                "allow_dropshipping_orders": True,
                "allow_inbound_goods": True,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(distribution_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(distribution_response.data["external_sku"], "RETAIL-SKU")

        serial_response = self.client.patch(
            reverse(
                "organization-product-serial-config",
                kwargs={"organization_id": self.organization.id, "product_id": product_id},
            ),
            {
                "tracking_mode": "REQUIRED",
                "serial_pattern": "SN-*",
                "capture_on_inbound": True,
                "capture_on_outbound": True,
            },
            format="json",
        )

        self.assertEqual(serial_response.status_code, status.HTTP_200_OK)
        self.assertEqual(serial_response.data["tracking_mode"], "REQUIRED")

        packaging_response = self.client.post(
            reverse(
                "organization-product-packaging-list",
                kwargs={"organization_id": self.organization.id, "product_id": product_id},
            ),
            {
                "package_type": "CARTON",
                "package_code": "carton-1",
                "units_per_package": 24,
                "length_cm": "40.00",
                "width_cm": "30.00",
                "height_cm": "25.00",
                "weight_kg": "8.50",
                "is_default": True,
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(packaging_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(packaging_response.data["package_code"], "CARTON-1")

        mark_response = self.client.post(
            reverse(
                "organization-product-mark-list",
                kwargs={"organization_id": self.organization.id, "product_id": product_id},
            ),
            {
                "mark_type": "FRAGILE",
                "value": "Handle With Care",
                "notes": "Keep upright",
                "is_active": True,
            },
            format="json",
        )

        self.assertEqual(mark_response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(mark_response.data["value"], "Handle With Care")

    def test_viewer_can_list_products_but_cannot_create(self) -> None:
        Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Bluetooth Scanner",
        )
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse(
                "organization-product-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        create_response = self.client.post(
            reverse(
                "organization-product-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "sku": "SKU-002",
                "name": "Thermal Printer",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(list_response.data), 1)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)
