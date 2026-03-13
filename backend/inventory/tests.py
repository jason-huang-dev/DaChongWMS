from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import InventoryBalance, InventoryHold, InventoryMovement, InventoryStatus, MovementType
from .views import InventoryBalanceViewSet, InventoryHoldViewSet, InventoryMovementViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Inventory Owner",
        "vip": 1,
        "openid": "inventory-openid",
        "appid": "inventory-appid",
        "t_code": "inventory-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Inventory Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "inventory-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Main Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "123 Example St",
        "warehouse_contact": "123-456",
        "warehouse_manager": "Manager",
        "creator": "creator",
        "openid": "inventory-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", create_warehouse())
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
        "max_volume": Decimal("3.0000"),
        "creator": "creator",
        "openid": "inventory-openid",
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
    warehouse = overrides.pop("warehouse", create_warehouse())
    zone = overrides.pop("zone", None)
    if zone is None:
        zone = create_zone(warehouse=warehouse)
    location_type = overrides.pop("location_type", None)
    if location_type is None:
        location_type = create_location_type(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "zone": zone,
        "location_type": location_type,
        "location_code": "A-01-01-01",
        "location_name": "Primary Pick Face",
        "barcode": "A-01-01-01",
        "capacity_qty": 100,
        "max_weight": Decimal("250.00"),
        "max_volume": Decimal("1.5000"),
        "pick_sequence": 1,
        "is_pick_face": True,
        "status": LocationStatus.AVAILABLE,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return Location.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU001",
        "goods_desc": "Widget",
        "goods_supplier": "Acme",
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
        "bar_code": "SKU001",
        "openid": "inventory-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


def create_balance(**overrides: Any) -> InventoryBalance:
    warehouse = overrides.pop("warehouse", create_warehouse())
    location = overrides.pop("location", None)
    if location is None:
        location = create_location(warehouse=warehouse)
    goods = overrides.pop("goods", None)
    if goods is None:
        goods = create_goods(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "location": location,
        "goods": goods,
        "stock_status": InventoryStatus.AVAILABLE,
        "lot_number": "",
        "serial_number": "",
        "on_hand_qty": Decimal("10.0000"),
        "allocated_qty": Decimal("2.0000"),
        "hold_qty": Decimal("1.0000"),
        "unit_cost": Decimal("5.0000"),
        "currency": "USD",
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return InventoryBalance.objects.create(**defaults)


class InventoryBalanceTests(TestCase):
    def test_available_qty_property(self) -> None:
        balance = create_balance()
        self.assertEqual(balance.available_qty, Decimal("7.0000"))


class InventoryApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="inventory-openid", appid="inventory-appid")
        self.user = get_user_model().objects.create_user(username="inventory-api", password="password")
        create_user_profile()
        self.operator = create_staff()

    def test_opening_movement_creates_balance(self) -> None:
        warehouse = create_warehouse()
        location = create_location(warehouse=warehouse)
        goods = create_goods(openid=warehouse.openid, goods_code="SKU-OPEN")
        view = InventoryMovementViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inventory/movements/",
            {
                "warehouse": warehouse.pk,
                "goods": goods.pk,
                "to_location": location.pk,
                "movement_type": MovementType.OPENING,
                "stock_status": InventoryStatus.AVAILABLE,
                "quantity": "12.5000",
                "unit_cost": "4.5000",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        balance = InventoryBalance.objects.get(goods=goods, location=location)
        self.assertEqual(balance.on_hand_qty, Decimal("12.5000"))
        self.assertEqual(balance.creator, self.operator.staff_name)

    def test_transfer_movement_updates_source_and_destination(self) -> None:
        warehouse = create_warehouse()
        source = create_location(warehouse=warehouse, location_code="SRC-01")
        destination = create_location(warehouse=warehouse, location_code="DST-01", zone=create_zone(warehouse=warehouse, zone_code="PICK", zone_name="Pick"))
        goods = create_goods(openid=warehouse.openid, goods_code="SKU-TRN")
        create_balance(warehouse=warehouse, location=source, goods=goods, on_hand_qty=Decimal("8.0000"), allocated_qty=Decimal("0.0000"), hold_qty=Decimal("0.0000"))
        view = InventoryMovementViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inventory/movements/",
            {
                "warehouse": warehouse.pk,
                "goods": goods.pk,
                "from_location": source.pk,
                "to_location": destination.pk,
                "movement_type": MovementType.TRANSFER,
                "stock_status": InventoryStatus.AVAILABLE,
                "quantity": "3.0000",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(InventoryBalance.objects.get(goods=goods, location=source).on_hand_qty, Decimal("5.0000"))
        self.assertEqual(InventoryBalance.objects.get(goods=goods, location=destination).on_hand_qty, Decimal("3.0000"))

    def test_hold_create_updates_balance_and_release_clears_it(self) -> None:
        balance = create_balance(on_hand_qty=Decimal("10.0000"), allocated_qty=Decimal("0.0000"), hold_qty=Decimal("0.0000"))
        hold_view = InventoryHoldViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/inventory/holds/",
            {
                "inventory_balance": balance.pk,
                "quantity": "4.0000",
                "reason": "Quality review",
                "notes": "",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(create_request, user=self.user, token=self.auth)
        create_response = hold_view(create_request)
        self.assertEqual(create_response.status_code, 201)
        balance.refresh_from_db()
        self.assertEqual(balance.hold_qty, Decimal("4.0000"))

        hold = InventoryHold.objects.get(pk=create_response.data["id"])
        release_view = InventoryHoldViewSet.as_view({"patch": "partial_update"})
        release_request = self.factory.patch(
            f"/api/inventory/holds/{hold.pk}/",
            {"is_active": False},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(release_request, user=self.user, token=self.auth)
        release_response = release_view(release_request, pk=hold.pk)
        self.assertEqual(release_response.status_code, 200)
        balance.refresh_from_db()
        hold.refresh_from_db()
        self.assertEqual(balance.hold_qty, Decimal("0.0000"))
        self.assertFalse(hold.is_active)

    def test_inventory_mutation_requires_authorized_role(self) -> None:
        warehouse = create_warehouse()
        location = create_location(warehouse=warehouse)
        goods = create_goods(openid=warehouse.openid, goods_code="SKU-DENY")
        denied_operator = create_staff(staff_name="Customer Operator", staff_type="Customer")
        view = InventoryMovementViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inventory/movements/",
            {
                "warehouse": warehouse.pk,
                "goods": goods.pk,
                "to_location": location.pk,
                "movement_type": MovementType.OPENING,
                "stock_status": InventoryStatus.AVAILABLE,
                "quantity": "1.0000",
            },
            format="json",
            HTTP_OPERATOR=str(denied_operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_balance_list_is_tenant_scoped(self) -> None:
        create_balance()
        other_warehouse = create_warehouse(openid="other-openid", warehouse_name="Other")
        other_location = create_location(warehouse=other_warehouse, openid="other-openid", location_code="OTH-01")
        other_goods = create_goods(openid="other-openid", goods_code="SKU-OTH", bar_code="SKU-OTH")
        create_balance(
            warehouse=other_warehouse,
            location=other_location,
            goods=other_goods,
            openid="other-openid",
        )
        view = InventoryBalanceViewSet.as_view({"get": "list"})
        request = self.factory.get("/api/inventory/balances/")
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)


class InventoryUrlsTests(TestCase):
    def test_routes_match_expected_paths(self) -> None:
        self.assertEqual(reverse("inventory:balance-list"), "/api/inventory/balances/")
        self.assertEqual(reverse("inventory:movement-detail", kwargs={"pk": 1}), "/api/inventory/movements/1/")
        self.assertEqual(resolve("/api/inventory/holds/").url_name, "hold-list")
