from __future__ import annotations

from decimal import Decimal

from django.test import TestCase

from apps.inventory.models import MovementType
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

