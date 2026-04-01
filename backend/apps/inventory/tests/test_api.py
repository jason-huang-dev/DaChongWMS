from __future__ import annotations

from datetime import date
from io import BytesIO

from django.contrib.auth.models import Permission
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from django.urls import reverse
from openpyxl import Workbook, load_workbook
from rest_framework import status
from rest_framework.test import APIClient

from apps.iam.models import Role
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_type,
    create_zone,
)
from apps.organizations.tests.test_factories import (
    add_membership,
    assign_role,
    grant_role_permission,
    make_organization,
    make_role,
    make_user,
)
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InventoryAPITests(TestCase):
    def setUp(self) -> None:
        self.client = APIClient()
        self.organization = make_organization()
        self.manager = make_user("manager@example.com")
        self.viewer = make_user("viewer@example.com")
        self.manager_membership = add_membership(self.manager, self.organization)
        self.viewer_membership = add_membership(self.viewer, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Scanner",
        )
        zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
            )
        )
        location_type = create_location_type(
            CreateLocationTypeInput(
                organization=self.organization,
                code="BULK",
                name="Bulk",
            )
        )
        self.location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code="A-01-01",
            )
        )

        manager_role = make_role(Role.SystemCode.MANAGER)
        staff_role = make_role(Role.SystemCode.STAFF)

        for codename in ("view_inventory", "manage_inventory_records", "manage_inventory_configuration"):
            permission = Permission.objects.get(
                content_type__app_label="inventory",
                codename=codename,
            )
            grant_role_permission(manager_role, permission)

        view_permission = Permission.objects.get(
            content_type__app_label="inventory",
            codename="view_inventory",
        )
        grant_role_permission(staff_role, view_permission)

        assign_role(self.manager_membership, manager_role)
        assign_role(self.viewer_membership, staff_role)

    def _build_import_file(self, rows: list[list[object]], file_name: str = "inventory.xlsx") -> SimpleUploadedFile:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Inventory Information"
        for row in rows:
            worksheet.append(row)

        stream = BytesIO()
        workbook.save(stream)
        return SimpleUploadedFile(
            file_name,
            stream.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    def test_manager_can_record_inventory_and_configure_adjustments(self) -> None:
        self.client.force_authenticate(self.manager)

        movement_response = self.client.post(
            reverse(
                "organization-inventory-movement-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "product_id": self.product.id,
                "to_location_id": self.location.id,
                "movement_type": "RECEIPT",
                "stock_status": "AVAILABLE",
                "quantity": "8.0000",
                "unit_cost": "3.2500",
                "currency": "usd",
                "reason": "Inbound receipt",
            },
            format="json",
        )
        self.assertEqual(movement_response.status_code, status.HTTP_201_CREATED)

        balances_response = self.client.get(
            reverse(
                "organization-inventory-balance-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        self.assertEqual(balances_response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(balances_response.data), 1)

        reason_response = self.client.post(
            reverse(
                "organization-inventory-adjustment-reason-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "code": "damage",
                "name": "Damage",
                "description": "Damage write-off",
                "direction": "DECREASE",
                "requires_approval": True,
                "is_active": True,
            },
            format="json",
        )
        self.assertEqual(reason_response.status_code, status.HTTP_201_CREATED)

    def test_viewer_can_list_balances_but_cannot_record_inventory(self) -> None:
        self.client.force_authenticate(self.viewer)

        list_response = self.client.get(
            reverse(
                "organization-inventory-balance-list",
                kwargs={"organization_id": self.organization.id},
            )
        )
        create_response = self.client.post(
            reverse(
                "organization-inventory-movement-list",
                kwargs={"organization_id": self.organization.id},
            ),
            {
                "warehouse_id": self.warehouse.id,
                "product_id": self.product.id,
                "to_location_id": self.location.id,
                "movement_type": "RECEIPT",
                "stock_status": "AVAILABLE",
                "quantity": "1.0000",
            },
            format="json",
        )

        self.assertEqual(list_response.status_code, status.HTTP_200_OK)
        self.assertEqual(create_response.status_code, status.HTTP_403_FORBIDDEN)

    def test_manager_can_download_inventory_information_template(self) -> None:
        self.client.force_authenticate(self.manager)

        response = self.client.get(
            reverse(
                "organization-inventory-information-import-template",
                kwargs={"organization_id": self.organization.id},
            )
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            response["Content-Type"],
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

        workbook = load_workbook(filename=BytesIO(response.content), read_only=True)
        worksheet = workbook[workbook.sheetnames[0]]
        header = [cell for cell in next(worksheet.iter_rows(values_only=True))]
        self.assertEqual(
            header,
            [
                "*Merchant SKU",
                "Product Name",
                "*Shelf",
                "*Available Stock",
                "Listing Time",
                "Actual Length",
                "Actual Width",
                "Actual Height",
                "Actual Weight",
                "*Unit of measurement (cm/g or in/lb)",
                "Merchant Code",
                "Customer Code",
            ],
        )

    def test_manager_can_upload_inventory_information_workbook_for_backend_processing(self) -> None:
        self.client.force_authenticate(self.manager)

        upload_file = self._build_import_file(
            [
                [
                    "*Merchant SKU",
                    "Product Name",
                    "*Shelf",
                    "*Available Stock",
                    "Listing Time",
                    "Actual Length",
                    "Actual Width",
                    "Actual Height",
                    "Actual Weight",
                    "*Unit of measurement (cm/g or in/lb)",
                    "Merchant Code",
                    "Customer Code",
                ],
                ["SKU-NEW-001", "New Scanner", "B-01-01", "12", "", "12.5", "8.2", "4.5", "260", "cm/g", "MER-001", "CUS-001"],
                ["SKU-NEW-001", "New Scanner", "B-01-01", "99", "2026-03-29", "12.5", "8.2", "4.5", "260", "cm/g", "MER-001", "CUS-001"],
            ]
        )

        response = self.client.post(
            reverse(
                "organization-inventory-information-import-upload",
                kwargs={"organization_id": self.organization.id},
            ),
            {"file": upload_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["errors"], [])
        self.assertEqual(
            response.data["warnings"],
            ["Duplicate Merchant SKU + Shelf detected for SKU-NEW-001 at B-01-01. The first row was kept."],
        )
        self.assertEqual(len(response.data["imported_rows"]), 1)
        self.assertEqual(response.data["imported_rows"][0]["merchant_sku"], "SKU-NEW-001")
        self.assertEqual(response.data["imported_rows"][0]["listing_time"], date.today().isoformat())

    def test_manager_inventory_import_fails_when_product_already_exists(self) -> None:
        self.client.force_authenticate(self.manager)

        upload_file = self._build_import_file(
            [
                [
                    "*Merchant SKU",
                    "Product Name",
                    "*Shelf",
                    "*Available Stock",
                    "Listing Time",
                    "Actual Length",
                    "Actual Width",
                    "Actual Height",
                    "Actual Weight",
                    "*Unit of measurement (cm/g or in/lb)",
                    "Merchant Code",
                    "Customer Code",
                ],
                ["SKU-001", "Scanner", "B-01-01", "12", "2026-03-29", "12.5", "8.2", "4.5", "260", "cm/g", "MER-001", "CUS-001"],
            ]
        )

        response = self.client.post(
            reverse(
                "organization-inventory-information-import-upload",
                kwargs={"organization_id": self.organization.id},
            ),
            {"file": upload_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["imported_rows"], [])
        self.assertEqual(response.data["warnings"], [])
        self.assertEqual(
            response.data["errors"],
            ["SKU-001 already exists in the Inventory List, so initialization failed."],
        )

    def test_manager_inventory_import_fails_when_existing_product_matches_case_insensitively(self) -> None:
        self.client.force_authenticate(self.manager)
        Product.objects.create(
            organization=self.organization,
            sku="sku-case-001",
            name="Case Variant Scanner",
        )

        upload_file = self._build_import_file(
            [
                [
                    "*Merchant SKU",
                    "Product Name",
                    "*Shelf",
                    "*Available Stock",
                    "Listing Time",
                    "Actual Length",
                    "Actual Width",
                    "Actual Height",
                    "Actual Weight",
                    "*Unit of measurement (cm/g or in/lb)",
                    "Merchant Code",
                    "Customer Code",
                ],
                ["SKU-CASE-001", "Scanner", "B-01-01", "12", "2026-03-29", "12.5", "8.2", "4.5", "260", "cm/g", "MER-001", "CUS-001"],
            ]
        )

        response = self.client.post(
            reverse(
                "organization-inventory-information-import-upload",
                kwargs={"organization_id": self.organization.id},
            ),
            {"file": upload_file},
            format="multipart",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["imported_rows"], [])
        self.assertEqual(response.data["warnings"], [])
        self.assertEqual(
            response.data["errors"],
            ["SKU-CASE-001 already exists in the Inventory List, so initialization failed."],
        )
