from __future__ import annotations

from decimal import Decimal

from django.test import TestCase

from apps.inventory.models import InventoryBalance, MovementType
from apps.locations.models import ZoneUsage
from apps.locations.services.location_service import (
    CreateLocationInput,
    CreateLocationTypeInput,
    CreateZoneInput,
    create_location,
    create_location_type,
    create_zone,
)
from apps.organizations.tests.test_factories import add_membership, make_organization, make_user
from apps.products.models import Product
from apps.transfers.models import ReplenishmentTaskStatus, TransferLineStatus, TransferOrderStatus
from apps.transfers.services.transfer_service import (
    CreateReplenishmentRuleInput,
    CreateTransferLineInput,
    CreateTransferOrderInput,
    complete_replenishment_task,
    complete_transfer_line,
    create_replenishment_rule,
    create_transfer_order,
    generate_replenishment_task,
)
from apps.warehouse.models import Warehouse


class TransferServiceTests(TestCase):
    def setUp(self) -> None:
        self.organization = make_organization()
        self.user = make_user("operator@example.com")
        self.membership = add_membership(self.user, self.organization)
        self.warehouse = Warehouse.objects.create(
            organization=self.organization,
            name="Primary",
            code="WH-A",
        )
        storage_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="STOR",
                name="Storage",
                usage=ZoneUsage.STORAGE,
            )
        )
        picking_zone = create_zone(
            CreateZoneInput(
                organization=self.organization,
                warehouse=self.warehouse,
                code="PICK",
                name="Picking",
                usage=ZoneUsage.PICKING,
                sequence=10,
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
                zone=storage_zone,
                location_type=location_type,
                code="BULK-01",
            )
        )
        self.to_location = create_location(
            CreateLocationInput(
                organization=self.organization,
                warehouse=self.warehouse,
                zone=picking_zone,
                location_type=location_type,
                code="PICK-01",
                is_pick_face=True,
            )
        )
        self.product = Product.objects.create(
            organization=self.organization,
            sku="SKU-001",
            name="Scanner",
        )
        self.source_balance = InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.from_location,
            product=self.product,
            stock_status="AVAILABLE",
            on_hand_qty=Decimal("20.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
        )
        InventoryBalance.objects.create(
            organization=self.organization,
            warehouse=self.warehouse,
            location=self.to_location,
            product=self.product,
            stock_status="AVAILABLE",
            on_hand_qty=Decimal("2.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            currency="USD",
        )

    def test_complete_transfer_line_moves_inventory_and_updates_status(self) -> None:
        transfer_order = create_transfer_order(
            CreateTransferOrderInput(
                organization=self.organization,
                warehouse=self.warehouse,
                transfer_number="TR-1001",
                line_items=(
                    CreateTransferLineInput(
                        line_number=1,
                        product=self.product,
                        from_location=self.from_location,
                        to_location=self.to_location,
                        requested_qty=Decimal("5.0000"),
                    ),
                ),
            )
        )

        line = transfer_order.lines.get()
        completed = complete_transfer_line(line, operator_name="operator@example.com")
        self.source_balance.refresh_from_db()
        destination_balance = InventoryBalance.objects.get(location=self.to_location, product=self.product)
        transfer_order.refresh_from_db()

        self.assertEqual(completed.status, TransferLineStatus.COMPLETED)
        self.assertEqual(completed.inventory_movement.movement_type, MovementType.TRANSFER)
        self.assertEqual(self.source_balance.on_hand_qty, Decimal("15.0000"))
        self.assertEqual(destination_balance.on_hand_qty, Decimal("7.0000"))
        self.assertEqual(transfer_order.status, TransferOrderStatus.COMPLETED)

    def test_replenishment_rule_generates_and_completes_task(self) -> None:
        rule = create_replenishment_rule(
            CreateReplenishmentRuleInput(
                organization=self.organization,
                warehouse=self.warehouse,
                product=self.product,
                source_location=self.from_location,
                target_location=self.to_location,
                minimum_qty=Decimal("5.0000"),
                target_qty=Decimal("10.0000"),
            )
        )

        task = generate_replenishment_task(rule, assigned_membership=self.membership)
        self.assertEqual(task.status, ReplenishmentTaskStatus.ASSIGNED)

        completed = complete_replenishment_task(task, operator_name="operator@example.com")
        self.source_balance.refresh_from_db()
        destination_balance = InventoryBalance.objects.get(location=self.to_location, product=self.product)

        self.assertEqual(completed.status, ReplenishmentTaskStatus.COMPLETED)
        self.assertEqual(self.source_balance.on_hand_qty, Decimal("12.0000"))
        self.assertEqual(destination_balance.on_hand_qty, Decimal("10.0000"))

