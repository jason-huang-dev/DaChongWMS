from __future__ import annotations

from decimal import Decimal

from django.test import TestCase
from rest_framework.exceptions import APIException

from catalog.goods.models import ListModel as Goods
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from warehouse.models import Warehouse

from scanner.services import transition_license_plate, upsert_license_plate_receipt
from utils.scanning import (
    resolve_and_validate_scan_attributes,
    resolve_goods_by_scan_code,
    resolve_license_plate_by_scan_code,
    resolve_location_by_scan_code,
)

from .models import AliasTargetType, BarcodeAlias, GoodsScanRule, LicensePlateStatus, ListModel


def create_warehouse(**overrides):
    defaults = {
        "warehouse_name": "Scanner Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "10 Scan Rd",
        "warehouse_contact": "555-1000",
        "warehouse_manager": "Scan Lead",
        "creator": "creator",
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides):
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
    return Zone.objects.create(**defaults)


def create_location_type(**overrides):
    defaults = {
        "type_code": "PALLET",
        "type_name": "Pallet Rack",
        "picking_enabled": True,
        "putaway_enabled": True,
        "allow_mixed_sku": True,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("2.0000"),
        "creator": "creator",
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return LocationType.objects.create(**defaults)


def create_location(**overrides):
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
        "max_weight": Decimal("100.00"),
        "max_volume": Decimal("1.0000"),
        "pick_sequence": 1,
        "is_pick_face": False,
        "status": LocationStatus.AVAILABLE,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return Location.objects.create(**defaults)


def create_goods(**overrides):
    defaults = {
        "goods_code": "SKU-SCAN-001",
        "goods_desc": "Scanner Widget",
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
        "bar_code": "BAR-SCAN-001",
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class ScannerTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.warehouse = create_warehouse()
        self.zone = create_zone(warehouse=self.warehouse)
        self.location_type = create_location_type(openid=self.warehouse.openid)
        self.location = create_location(warehouse=self.warehouse, zone=self.zone, location_type=self.location_type)
        self.goods = create_goods(openid=self.warehouse.openid)

    def test_list_model_str(self) -> None:
        obj = ListModel.objects.create(
            mode="Value",
            code="CODE123",
            bar_code="BAR123",
            openid=self.warehouse.openid,
        )
        self.assertIn("Value", str(obj))

    def test_goods_and_location_aliases_resolve_scan_codes(self) -> None:
        BarcodeAlias.objects.create(
            target_type=AliasTargetType.GOODS,
            alias_code="SKU-ALIAS-1",
            goods=self.goods,
            creator="creator",
            openid=self.warehouse.openid,
        )
        BarcodeAlias.objects.create(
            target_type=AliasTargetType.LOCATION,
            alias_code="LOC-ALIAS-1",
            location=self.location,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.assertEqual(resolve_goods_by_scan_code(openid=self.warehouse.openid, scan_code="SKU-ALIAS-1").id, self.goods.id)
        self.assertEqual(
            resolve_location_by_scan_code(openid=self.warehouse.openid, warehouse=self.warehouse, scan_code="LOC-ALIAS-1").id,
            self.location.id,
        )

    def test_scan_rules_require_lot_and_serial_patterns(self) -> None:
        GoodsScanRule.objects.create(
            goods=self.goods,
            requires_lot=True,
            requires_serial=True,
            lot_pattern=r"LOT-\d+",
            serial_pattern=r"SER-\d+",
            creator="creator",
            openid=self.warehouse.openid,
        )
        lot_number, serial_number = resolve_and_validate_scan_attributes(
            openid=self.warehouse.openid,
            goods=self.goods,
            lot_number="",
            serial_number="",
            attribute_scan="LOT:LOT-100|SERIAL:SER-200",
        )
        self.assertEqual(lot_number, "LOT-100")
        self.assertEqual(serial_number, "SER-200")
        with self.assertRaises(APIException):
            resolve_and_validate_scan_attributes(
                openid=self.warehouse.openid,
                goods=self.goods,
                lot_number="BAD",
                serial_number="SER-200",
            )

    def test_license_plate_receipt_and_transition(self) -> None:
        license_plate = upsert_license_plate_receipt(
            openid=self.warehouse.openid,
            operator_name="creator",
            warehouse=self.warehouse,
            goods=self.goods,
            lpn_code="LPN-001",
            quantity=Decimal("2.0000"),
            location=self.location,
            lot_number="LOT-100",
            serial_number="",
            reference_code="RCPT-1",
        )
        self.assertEqual(license_plate.status, LicensePlateStatus.RECEIVED)
        self.assertEqual(resolve_license_plate_by_scan_code(openid=self.warehouse.openid, warehouse=self.warehouse, scan_code="LPN-001").id, license_plate.id)
        moved = transition_license_plate(
            openid=self.warehouse.openid,
            license_plate=license_plate,
            location=self.location,
            status=LicensePlateStatus.STORED,
            reference_code="PUT-1",
        )
        self.assertEqual(moved.status, LicensePlateStatus.STORED)
