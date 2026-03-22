from __future__ import annotations

from django.test import TestCase

from apps.organizations.tests.test_factories import make_organization
from apps.warehouse.services.warehouse_service import (
    CreateWarehouseInput,
    create_warehouse,
    update_warehouse,
)


class WarehouseServiceTests(TestCase):
    def test_create_warehouse_normalizes_code(self) -> None:
        warehouse = create_warehouse(
            CreateWarehouseInput(
                organization=make_organization(),
                name="Primary Warehouse",
                code=" wh-a ",
            )
        )
        self.assertEqual(warehouse.code, "WH-A")

    def test_update_warehouse_applies_changes(self) -> None:
        warehouse = create_warehouse(
            CreateWarehouseInput(
                organization=make_organization(),
                name="Primary Warehouse",
                code="WH-A",
            )
        )

        update_warehouse(warehouse, name="Overflow", is_active=False)
        warehouse.refresh_from_db()

        self.assertEqual(warehouse.name, "Overflow")
        self.assertFalse(warehouse.is_active)
