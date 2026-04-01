from __future__ import annotations

from datetime import date
from decimal import Decimal
from io import BytesIO

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from openpyxl import Workbook

from apps.inventory.models import MovementType
from apps.inventory.services.inventory_information_import_service import (
    TEMPLATE_HEADERS,
    process_inventory_information_import,
)
from apps.inventory.services.inventory_service import (
    CreateInventoryHoldInput,
    CreateInventoryMovementInput,
    create_inventory_hold,
    record_inventory_movement,
    release_inventory_hold,
)
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_type,
    create_zone,
)
from apps.organizations.tests.test_factories import make_organization
from apps.products.models import Product
from apps.warehouse.models import Warehouse


class InventoryServiceTests(TestCase):
    def setUp(self) -> None:
        self.organization = make_organization()
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
        self.from_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code="A-01-01",
            )
        )
        self.to_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=zone,
                location_type=location_type,
                code="A-01-02",
            )
        )

    def test_receipt_and_transfer_update_balances(self) -> None:
        receipt = record_inventory_movement(
            CreateInventoryMovementInput(
                organization=self.organization,
                warehouse=self.warehouse,
                product=self.product,
                movement_type=MovementType.RECEIPT,
                quantity=Decimal("10.0000"),
                performed_by="manager@example.com",
                to_location=self.from_location,
            )
        )

        self.assertEqual(receipt.resulting_to_qty, Decimal("10.0000"))

        transfer = record_inventory_movement(
            CreateInventoryMovementInput(
                organization=self.organization,
                warehouse=self.warehouse,
                product=self.product,
                movement_type=MovementType.TRANSFER,
                quantity=Decimal("4.0000"),
                performed_by="manager@example.com",
                from_location=self.from_location,
                to_location=self.to_location,
            )
        )

        self.assertEqual(transfer.resulting_from_qty, Decimal("6.0000"))
        self.assertEqual(transfer.resulting_to_qty, Decimal("4.0000"))

    def test_create_and_release_hold_updates_hold_quantity(self) -> None:
        record_inventory_movement(
            CreateInventoryMovementInput(
                organization=self.organization,
                warehouse=self.warehouse,
                product=self.product,
                movement_type=MovementType.RECEIPT,
                quantity=Decimal("5.0000"),
                performed_by="manager@example.com",
                to_location=self.from_location,
            )
        )
        balance = self.product.inventory_balances.get(location=self.from_location)

        hold = create_inventory_hold(
            CreateInventoryHoldInput(
                organization=self.organization,
                inventory_balance=balance,
                quantity=Decimal("2.0000"),
                reason="Inspection",
                held_by="manager@example.com",
            )
        )
        balance.refresh_from_db()
        self.assertEqual(balance.hold_qty, Decimal("2.0000"))

        release_inventory_hold(hold, released_by="manager@example.com")
        balance.refresh_from_db()
        hold.refresh_from_db()
        self.assertFalse(hold.is_active)
        self.assertEqual(balance.hold_qty, Decimal("0.0000"))


class InventoryInformationImportServiceTests(TestCase):
    def setUp(self) -> None:
        self.organization = make_organization(name="Import Org", slug="import-org")

    def _build_import_file(self, rows: list[list[object]], file_name: str = "inventory.xlsx") -> SimpleUploadedFile:
        workbook = Workbook()
        worksheet = workbook.active
        worksheet.title = "Inventory Information"
        worksheet.append(list(TEMPLATE_HEADERS))
        for row in rows:
            worksheet.append(row)

        stream = BytesIO()
        workbook.save(stream)
        return SimpleUploadedFile(
            file_name,
            stream.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    def test_rejects_multiple_rows_for_same_merchant_sku_even_with_different_codes(self) -> None:
        workbook_file = self._build_import_file(
            [
                ["SKU-NEW-001", "Scanner", "A-01-01", "10", "2026-03-29", "12.5", "8.2", "4.5", "260", "cm/g", "MER-001", "CUS-001"],
                ["SKU-NEW-001", "Scanner", "B-01-01", "8", "2026-03-29", "12.5", "8.2", "4.5", "260", "cm/g", "MER-ALT", "CUS-002"],
            ]
        )

        result = process_inventory_information_import(
            organization=self.organization,
            workbook_file=workbook_file,
            import_date=date(2026, 3, 31),
        )

        self.assertEqual(result.imported_rows, [])
        self.assertEqual(result.warnings, [])
        self.assertEqual(
            result.errors,
            ["SKU-NEW-001 appears multiple times. Inventory initialization allows only one row per Merchant SKU."],
        )
