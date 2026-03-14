from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from inventory.models import InventoryBalance, InventoryMovement, MovementType
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import ReplenishmentTask, ReplenishmentTaskStatus, TransferLineStatus, TransferOrder, TransferOrderStatus
from .views import ReplenishmentRuleViewSet, ReplenishmentTaskViewSet, TransferLineViewSet, TransferOrderViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Transfer Owner",
        "vip": 1,
        "openid": "transfer-openid",
        "appid": "transfer-appid",
        "t_code": "transfer-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Transfer Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "transfer-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Transfer Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "300 Move St",
        "warehouse_contact": "555-3300",
        "warehouse_manager": "Move Lead",
        "creator": "creator",
        "openid": "transfer-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "STO",
        "zone_name": "Storage",
        "usage": ZoneUsage.STORAGE,
        "sequence": 10,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    zone, _ = Zone.objects.get_or_create(
        warehouse=defaults["warehouse"],
        zone_code=defaults["zone_code"],
        openid=defaults["openid"],
        is_delete=False,
        defaults=defaults,
    )
    return zone


def create_location_type(**overrides: Any) -> LocationType:
    defaults = {
        "type_code": "PALLET",
        "type_name": "Pallet Rack",
        "picking_enabled": True,
        "putaway_enabled": True,
        "allow_mixed_sku": False,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "transfer-openid",
    }
    defaults.update(overrides)
    location_type, _ = LocationType.objects.get_or_create(
        type_code=defaults["type_code"],
        openid=defaults["openid"],
        is_delete=False,
        defaults=defaults,
    )
    return location_type


def create_location(**overrides: Any) -> Location:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    zone = overrides.pop("zone", None) or create_zone(warehouse=warehouse)
    location_type = overrides.pop("location_type", None) or create_location_type(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "zone": zone,
        "location_type": location_type,
        "location_code": "LOC-01",
        "location_name": "Location 01",
        "barcode": "LOC-01",
        "capacity_qty": 100,
        "max_weight": Decimal("250.00"),
        "max_volume": Decimal("1.5000"),
        "pick_sequence": 1,
        "is_pick_face": False,
        "status": LocationStatus.AVAILABLE,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return Location.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-TRN-001",
        "goods_desc": "Transfer Widget",
        "goods_supplier": "Internal",
        "goods_weight": 1,
        "goods_w": 1,
        "goods_d": 1,
        "goods_h": 1,
        "unit_volume": 1,
        "goods_unit": "EA",
        "goods_class": "General",
        "goods_brand": "Acme",
        "goods_color": "Blue",
        "goods_shape": "Box",
        "goods_specs": "Standard",
        "goods_origin": "USA",
        "goods_cost": 10,
        "goods_price": 20,
        "creator": "creator",
        "bar_code": "BAR-TRN-001",
        "openid": "transfer-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class TransfersApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="transfer-openid", appid="transfer-appid")
        self.user = get_user_model().objects.create_user(username="transfer-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.viewer = create_staff(staff_name="Viewer", staff_type="Viewer", check_code=4321)
        self.replenisher = create_staff(staff_name="Replenisher", staff_type="StockControl", check_code=2468)
        self.warehouse = create_warehouse()
        self.storage_zone = create_zone(warehouse=self.warehouse, zone_code="STO", zone_name="Storage", usage=ZoneUsage.STORAGE)
        self.picking_zone = create_zone(warehouse=self.warehouse, zone_code="PICK", zone_name="Picking", usage=ZoneUsage.PICKING, sequence=20)
        self.storage_type = create_location_type(openid=self.warehouse.openid, type_code="PALLET", type_name="Pallet Rack")
        self.pick_type = create_location_type(openid=self.warehouse.openid, type_code="PICK", type_name="Pick Face", picking_enabled=True)
        self.bulk_location = create_location(
            warehouse=self.warehouse,
            zone=self.storage_zone,
            location_type=self.storage_type,
            location_code="BULK-01",
            location_name="Bulk 01",
            barcode="BULK-01",
        )
        self.pick_location = create_location(
            warehouse=self.warehouse,
            zone=self.picking_zone,
            location_type=self.pick_type,
            location_code="PICK-01",
            location_name="Pick 01",
            barcode="PICK-01",
            is_pick_face=True,
        )
        self.alt_pick_location = create_location(
            warehouse=self.warehouse,
            zone=self.picking_zone,
            location_type=self.pick_type,
            location_code="PICK-02",
            location_name="Pick 02",
            barcode="PICK-02",
            is_pick_face=True,
        )
        self.goods = create_goods(openid=self.warehouse.openid)
        self.bulk_balance = InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.bulk_location,
            goods=self.goods,
            stock_status="AVAILABLE",
            lot_number="",
            serial_number="",
            on_hand_qty=Decimal("20.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.pick_balance = InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.pick_location,
            goods=self.goods,
            stock_status="AVAILABLE",
            lot_number="",
            serial_number="",
            on_hand_qty=Decimal("2.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.5000"),
            creator="creator",
            openid=self.warehouse.openid,
        )

    def _auth_request(self, request, operator: Staff) -> None:
        request.META["HTTP_OPERATOR"] = str(operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def test_transfer_order_create_generates_header_and_lines(self) -> None:
        view = TransferOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/transfers/transfer-orders/",
            {
                "warehouse": self.warehouse.pk,
                "transfer_number": "TR-1001",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "from_location": self.bulk_location.pk,
                        "to_location": self.pick_location.pk,
                        "requested_qty": "5.0000",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(request, self.operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        transfer_order = TransferOrder.objects.get(transfer_number="TR-1001")
        self.assertEqual(transfer_order.status, TransferOrderStatus.OPEN)
        self.assertEqual(transfer_order.lines.count(), 1)
        self.assertEqual(transfer_order.lines.get().requested_qty, Decimal("5.0000"))

    def test_complete_transfer_line_moves_inventory_and_completes_order(self) -> None:
        transfer_order = TransferOrder.objects.create(
            warehouse=self.warehouse,
            transfer_number="TR-2001",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        line = transfer_order.lines.create(
            line_number=1,
            goods=self.goods,
            from_location=self.bulk_location,
            to_location=self.pick_location,
            requested_qty=Decimal("5.0000"),
            stock_status="AVAILABLE",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )

        view = TransferLineViewSet.as_view({"post": "complete"})
        request = self.factory.post(f"/api/transfers/transfer-lines/{line.pk}/complete/", {}, format="json")
        self._auth_request(request, self.operator)
        response = view(request, pk=line.pk)
        self.assertEqual(response.status_code, 200)

        line.refresh_from_db()
        transfer_order.refresh_from_db()
        self.bulk_balance.refresh_from_db()
        self.pick_balance.refresh_from_db()
        self.assertEqual(line.status, TransferLineStatus.COMPLETED)
        self.assertEqual(transfer_order.status, TransferOrderStatus.COMPLETED)
        self.assertEqual(self.bulk_balance.on_hand_qty, Decimal("15.0000"))
        self.assertEqual(self.pick_balance.on_hand_qty, Decimal("7.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.TRANSFER).count(), 1)

    def test_replenishment_rule_generate_and_complete_posts_transfer(self) -> None:
        rule_view = ReplenishmentRuleViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/transfers/replenishment-rules/",
            {
                "warehouse": self.warehouse.pk,
                "goods": self.goods.pk,
                "source_location": self.bulk_location.pk,
                "target_location": self.pick_location.pk,
                "minimum_qty": "5.0000",
                "target_qty": "10.0000",
                "priority": 10,
            },
            format="json",
        )
        self._auth_request(create_request, self.operator)
        create_response = rule_view(create_request)
        self.assertEqual(create_response.status_code, 201)
        rule_id = create_response.data["id"]

        generate_view = ReplenishmentRuleViewSet.as_view({"post": "generate_task"})
        generate_request = self.factory.post(
            f"/api/transfers/replenishment-rules/{rule_id}/generate-task/",
            {"assigned_to": self.replenisher.pk},
            format="json",
        )
        self._auth_request(generate_request, self.operator)
        generate_response = generate_view(generate_request, pk=rule_id)
        self.assertEqual(generate_response.status_code, 201)
        task = ReplenishmentTask.objects.get(pk=generate_response.data["id"])
        self.assertEqual(task.quantity, Decimal("8.0000"))
        self.assertEqual(task.status, ReplenishmentTaskStatus.ASSIGNED)

        complete_view = ReplenishmentTaskViewSet.as_view({"post": "complete"})
        complete_request = self.factory.post(
            f"/api/transfers/replenishment-tasks/{task.pk}/complete/",
            {},
            format="json",
        )
        self._auth_request(complete_request, self.replenisher)
        complete_response = complete_view(complete_request, pk=task.pk)
        self.assertEqual(complete_response.status_code, 200)

        task.refresh_from_db()
        self.bulk_balance.refresh_from_db()
        self.pick_balance.refresh_from_db()
        self.assertEqual(task.status, ReplenishmentTaskStatus.COMPLETED)
        self.assertEqual(self.bulk_balance.on_hand_qty, Decimal("12.0000"))
        self.assertEqual(self.pick_balance.on_hand_qty, Decimal("10.0000"))

    def test_replenishment_generate_rejects_when_target_already_above_minimum(self) -> None:
        self.pick_balance.on_hand_qty = Decimal("6.0000")
        self.pick_balance.save(update_fields=["on_hand_qty", "update_time"])
        rule = ReplenishmentRuleViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/transfers/replenishment-rules/",
            {
                "warehouse": self.warehouse.pk,
                "goods": self.goods.pk,
                "source_location": self.bulk_location.pk,
                "target_location": self.pick_location.pk,
                "minimum_qty": "5.0000",
                "target_qty": "10.0000",
            },
            format="json",
        )
        self._auth_request(create_request, self.operator)
        create_response = rule(create_request)
        self.assertEqual(create_response.status_code, 201)

        rule_id = create_response.data["id"]
        generate_view = ReplenishmentRuleViewSet.as_view({"post": "generate_task"})
        generate_request = self.factory.post(
            f"/api/transfers/replenishment-rules/{rule_id}/generate-task/",
            {},
            format="json",
        )
        self._auth_request(generate_request, self.operator)
        generate_response = generate_view(generate_request, pk=rule_id)
        self.assertEqual(generate_response.status_code, 400)

    def test_permission_denies_unapproved_role(self) -> None:
        view = TransferOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/transfers/transfer-orders/",
            {
                "warehouse": self.warehouse.pk,
                "transfer_number": "TR-403",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "from_location": self.bulk_location.pk,
                        "to_location": self.pick_location.pk,
                        "requested_qty": "1.0000",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(request, self.viewer)
        response = view(request)
        self.assertEqual(response.status_code, 403)


class TransfersUrlsTests(TestCase):
    def test_routes_match_expected_paths(self) -> None:
        self.assertEqual(reverse("transfers:transfer-order-list"), "/api/transfers/transfer-orders/")
        self.assertEqual(reverse("transfers:transfer-line-complete", kwargs={"pk": 1}), "/api/transfers/transfer-lines/1/complete/")
        self.assertEqual(reverse("transfers:replenishment-rule-list"), "/api/transfers/replenishment-rules/")
        self.assertEqual(reverse("transfers:replenishment-rule-generate-task", kwargs={"pk": 1}), "/api/transfers/replenishment-rules/1/generate-task/")
        self.assertEqual(reverse("transfers:replenishment-task-complete", kwargs={"pk": 1}), "/api/transfers/replenishment-tasks/1/complete/")

    def test_views_resolve_correctly(self) -> None:
        self.assertEqual(resolve("/api/transfers/transfer-orders/").view_name, "transfers:transfer-order-list")
        self.assertEqual(resolve("/api/transfers/replenishment-rules/").view_name, "transfers:replenishment-rule-list")
        self.assertEqual(resolve("/api/transfers/replenishment-tasks/").view_name, "transfers:replenishment-task-list")
