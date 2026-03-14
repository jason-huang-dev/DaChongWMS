"""Tenant bootstrap services for smoke-test and demo environments."""

from __future__ import annotations

import re
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.utils import timezone

from capital.models import ListModel as Capital
from catalog.goods.models import ListModel as Goods
from catalog.goodsbrand.models import ListModel as GoodsBrand
from catalog.goodsclass.models import ListModel as GoodsClass
from catalog.goodscolor.models import ListModel as GoodsColor
from catalog.goodsorigin.models import ListModel as GoodsOrigin
from catalog.goodsshape.models import ListModel as GoodsShape
from catalog.goodsspecs.models import ListModel as GoodsSpecs
from catalog.goodsunit.models import ListModel as GoodsUnit
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryHold, InventoryMovement, InventoryStatus, MovementType
from inventory.services import create_inventory_hold, record_inventory_movement
from locations.models import Location, LocationLock, LocationStatus, LocationType, Zone, ZoneUsage
from payment.models import TransportationFeeListModel
from scanner.models import ListModel as Scanner
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from userprofile.models import Users
from utils.md5 import Md5
from warehouse.models import Warehouse

DEFAULT_BOOTSTRAP_USERNAME = "test-system-admin"
DEFAULT_BOOTSTRAP_PASSWORD = "TestSystem123!"
SYSTEM_CREATOR = "TestSystem"
MEDIA_SUBDIRECTORIES = ("win32", "linux", "darwin")


@dataclass(frozen=True)
class BootstrapResult:
    auth_user: object
    profile: Users
    admin_staff: Staff
    seed_summary: dict[str, int]


def _tenant_tag(username: str, openid: str) -> str:
    base = re.sub(r"[^A-Za-z0-9]+", "", username).upper() or "TESTSYSTEM"
    return f"{base[:8]}-{openid[:6].upper()}"


def ensure_media_directories(openid: str) -> None:
    tenant_root = Path(settings.MEDIA_ROOT) / openid
    tenant_root.mkdir(parents=True, exist_ok=True)
    for folder in MEDIA_SUBDIRECTORIES:
        (tenant_root / folder).mkdir(parents=True, exist_ok=True)


def _create_catalog_records(*, openid: str, creator: str, tenant_tag: str) -> dict[str, list[object]]:
    units = [
        GoodsUnit.objects.create(goods_unit=f"{tenant_tag}-EA", creator=creator, openid=openid),
        GoodsUnit.objects.create(goods_unit=f"{tenant_tag}-CASE", creator=creator, openid=openid),
        GoodsUnit.objects.create(goods_unit=f"{tenant_tag}-PALLET", creator=creator, openid=openid),
    ]
    classes = [
        GoodsClass.objects.create(goods_class=f"{tenant_tag}-GENERAL", creator=creator, openid=openid),
        GoodsClass.objects.create(goods_class=f"{tenant_tag}-COLD", creator=creator, openid=openid),
        GoodsClass.objects.create(goods_class=f"{tenant_tag}-HAZMAT", creator=creator, openid=openid),
    ]
    brands = [
        GoodsBrand.objects.create(goods_brand=f"{tenant_tag}-ALPHA", creator=creator, openid=openid),
        GoodsBrand.objects.create(goods_brand=f"{tenant_tag}-BETA", creator=creator, openid=openid),
        GoodsBrand.objects.create(goods_brand=f"{tenant_tag}-GAMMA", creator=creator, openid=openid),
    ]
    colors = [
        GoodsColor.objects.create(goods_color=f"{tenant_tag}-BLUE", creator=creator, openid=openid),
        GoodsColor.objects.create(goods_color=f"{tenant_tag}-GREEN", creator=creator, openid=openid),
        GoodsColor.objects.create(goods_color=f"{tenant_tag}-GRAY", creator=creator, openid=openid),
    ]
    shapes = [
        GoodsShape.objects.create(goods_shape=f"{tenant_tag}-BOX", creator=creator, openid=openid),
        GoodsShape.objects.create(goods_shape=f"{tenant_tag}-TOTE", creator=creator, openid=openid),
        GoodsShape.objects.create(goods_shape=f"{tenant_tag}-DRUM", creator=creator, openid=openid),
    ]
    specs = [
        GoodsSpecs.objects.create(goods_specs=f"{tenant_tag}-SMALL", creator=creator, openid=openid),
        GoodsSpecs.objects.create(goods_specs=f"{tenant_tag}-MEDIUM", creator=creator, openid=openid),
        GoodsSpecs.objects.create(goods_specs=f"{tenant_tag}-LARGE", creator=creator, openid=openid),
    ]
    origins = [
        GoodsOrigin.objects.create(goods_origin=f"{tenant_tag}-NEWYORK", creator=creator, openid=openid),
        GoodsOrigin.objects.create(goods_origin=f"{tenant_tag}-BOSTON", creator=creator, openid=openid),
        GoodsOrigin.objects.create(goods_origin=f"{tenant_tag}-CHICAGO", creator=creator, openid=openid),
    ]
    return {
        "units": units,
        "classes": classes,
        "brands": brands,
        "colors": colors,
        "shapes": shapes,
        "specs": specs,
        "origins": origins,
    }


@transaction.atomic
def bootstrap_test_system(*, username: str, password: str, ip: str) -> BootstrapResult:
    user_model = get_user_model()
    transaction_code = Md5.md5(username)
    tenant_tag = _tenant_tag(username=username, openid=transaction_code)

    auth_user = user_model.objects.create_user(username=username, password=password)
    profile = Users.objects.create(
        user_id=auth_user.id,
        name=username,
        openid=transaction_code,
        appid=Md5.md5(f"{username}-appid"),
        t_code=Md5.md5(str(timezone.now())),
        developer=True,
        ip=ip,
    )
    admin_staff = Staff.objects.create(
        staff_name=username,
        staff_type="Manager",
        check_code=8888,
        openid=transaction_code,
    )

    for role, staff_name in (
        ("Supervisor", "Test Supervisor"),
        ("Inbound", "Test Inbound"),
        ("Outbound", "Test Outbound"),
        ("StockControl", "Test Stock Control"),
    ):
        Staff.objects.create(
            staff_name=f"{tenant_tag}-{staff_name}",
            staff_type=role,
            check_code=8888,
            openid=transaction_code,
        )

    warehouse = Warehouse.objects.create(
        warehouse_name=f"{tenant_tag} Main Warehouse",
        warehouse_city="New York",
        warehouse_address="100 Test System Way",
        warehouse_contact="555-0100",
        warehouse_manager=username,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )

    receiving_zone = Zone.objects.create(
        warehouse=warehouse,
        zone_code="RCV",
        zone_name="Receiving",
        usage=ZoneUsage.RECEIVING,
        sequence=10,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    storage_zone = Zone.objects.create(
        warehouse=warehouse,
        zone_code="STO",
        zone_name="Storage",
        usage=ZoneUsage.STORAGE,
        sequence=20,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    picking_zone = Zone.objects.create(
        warehouse=warehouse,
        zone_code="PICK",
        zone_name="Picking",
        usage=ZoneUsage.PICKING,
        sequence=30,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    quarantine_zone = Zone.objects.create(
        warehouse=warehouse,
        zone_code="QUA",
        zone_name="Quarantine",
        usage=ZoneUsage.QUARANTINE,
        sequence=40,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )

    receiving_type = LocationType.objects.create(
        type_code="RECV-STAGE",
        type_name="Receiving Stage",
        picking_enabled=False,
        putaway_enabled=True,
        allow_mixed_sku=True,
        max_weight=Decimal("5000.00"),
        max_volume=Decimal("12.0000"),
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    pallet_type = LocationType.objects.create(
        type_code="PALLET",
        type_name="Pallet Rack",
        picking_enabled=True,
        putaway_enabled=True,
        allow_mixed_sku=False,
        max_weight=Decimal("1500.00"),
        max_volume=Decimal("4.0000"),
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    pickface_type = LocationType.objects.create(
        type_code="PICKFACE",
        type_name="Pick Face",
        picking_enabled=True,
        putaway_enabled=True,
        allow_mixed_sku=False,
        max_weight=Decimal("250.00"),
        max_volume=Decimal("1.5000"),
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    quarantine_type = LocationType.objects.create(
        type_code="QUAR",
        type_name="Quarantine Bin",
        picking_enabled=False,
        putaway_enabled=False,
        allow_mixed_sku=True,
        max_weight=Decimal("1000.00"),
        max_volume=Decimal("3.0000"),
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )

    receiving_location = Location.objects.create(
        warehouse=warehouse,
        zone=receiving_zone,
        location_type=receiving_type,
        location_code="RCV-01",
        location_name="Receiving Dock 01",
        barcode=f"{tenant_tag}-RCV-01",
        capacity_qty=200,
        max_weight=Decimal("5000.00"),
        max_volume=Decimal("12.0000"),
        pick_sequence=1,
        is_pick_face=False,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    storage_a = Location.objects.create(
        warehouse=warehouse,
        zone=storage_zone,
        location_type=pallet_type,
        location_code="STO-A-01",
        location_name="Storage A01",
        aisle="A",
        bay="01",
        level="01",
        slot="01",
        barcode=f"{tenant_tag}-STO-A-01",
        capacity_qty=120,
        max_weight=Decimal("1500.00"),
        max_volume=Decimal("4.0000"),
        pick_sequence=10,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    storage_b = Location.objects.create(
        warehouse=warehouse,
        zone=storage_zone,
        location_type=pallet_type,
        location_code="STO-A-02",
        location_name="Storage A02",
        aisle="A",
        bay="01",
        level="01",
        slot="02",
        barcode=f"{tenant_tag}-STO-A-02",
        capacity_qty=120,
        max_weight=Decimal("1500.00"),
        max_volume=Decimal("4.0000"),
        pick_sequence=20,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    pick_face = Location.objects.create(
        warehouse=warehouse,
        zone=picking_zone,
        location_type=pickface_type,
        location_code="PICK-01",
        location_name="Primary Pick Face",
        aisle="P",
        bay="01",
        level="01",
        slot="01",
        barcode=f"{tenant_tag}-PICK-01",
        capacity_qty=24,
        max_weight=Decimal("250.00"),
        max_volume=Decimal("1.5000"),
        pick_sequence=30,
        is_pick_face=True,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    quarantine_location = Location.objects.create(
        warehouse=warehouse,
        zone=quarantine_zone,
        location_type=quarantine_type,
        location_code="QUA-01",
        location_name="Quarantine Bin",
        aisle="Q",
        bay="01",
        level="01",
        slot="01",
        barcode=f"{tenant_tag}-QUA-01",
        capacity_qty=50,
        max_weight=Decimal("1000.00"),
        max_volume=Decimal("3.0000"),
        pick_sequence=40,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )

    LocationLock.objects.create(
        location=quarantine_location,
        reason="Seeded quarantine hold",
        notes="Reserved by the test-system bootstrap for smoke-test validation.",
        locked_by=username,
        creator=SYSTEM_CREATOR,
        openid=transaction_code,
    )
    quarantine_location.is_locked = True
    quarantine_location.status = LocationStatus.BLOCKED
    quarantine_location.save(update_fields=["is_locked", "status", "update_time"])

    suppliers = [
        Supplier.objects.create(
            supplier_name=f"{tenant_tag}-SUP-01",
            supplier_city="New York",
            supplier_address="10 Supplier Row",
            supplier_contact="555-0201",
            supplier_manager="Supplier Manager 1",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
        Supplier.objects.create(
            supplier_name=f"{tenant_tag}-SUP-02",
            supplier_city="Boston",
            supplier_address="20 Supplier Row",
            supplier_contact="555-0202",
            supplier_manager="Supplier Manager 2",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
        Supplier.objects.create(
            supplier_name=f"{tenant_tag}-SUP-03",
            supplier_city="Chicago",
            supplier_address="30 Supplier Row",
            supplier_contact="555-0203",
            supplier_manager="Supplier Manager 3",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
    ]
    customers = [
        Customer.objects.create(
            customer_name=f"{tenant_tag}-CUS-01",
            customer_city="New York",
            customer_address="10 Customer Ave",
            customer_contact="555-0301",
            customer_manager="Customer Manager 1",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
        Customer.objects.create(
            customer_name=f"{tenant_tag}-CUS-02",
            customer_city="Boston",
            customer_address="20 Customer Ave",
            customer_contact="555-0302",
            customer_manager="Customer Manager 2",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
        Customer.objects.create(
            customer_name=f"{tenant_tag}-CUS-03",
            customer_city="Chicago",
            customer_address="30 Customer Ave",
            customer_contact="555-0303",
            customer_manager="Customer Manager 3",
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
    ]
    capitals = [
        Capital.objects.create(
            capital_name=f"{tenant_tag}-CAP-01",
            capital_qty=100,
            capital_cost=1500,
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
        Capital.objects.create(
            capital_name=f"{tenant_tag}-CAP-02",
            capital_qty=50,
            capital_cost=2250,
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        ),
    ]

    catalog_records = _create_catalog_records(openid=transaction_code, creator=SYSTEM_CREATOR, tenant_tag=tenant_tag)
    units = catalog_records["units"]
    classes = catalog_records["classes"]
    brands = catalog_records["brands"]
    colors = catalog_records["colors"]
    shapes = catalog_records["shapes"]
    specs = catalog_records["specs"]
    origins = catalog_records["origins"]

    goods_one = Goods.objects.create(
        goods_code=f"{tenant_tag}-SKU-001",
        goods_desc="Seeded pallet stock",
        goods_supplier=suppliers[0].supplier_name,
        goods_weight=4.5,
        goods_w=0.60,
        goods_d=0.40,
        goods_h=0.30,
        unit_volume=0.072,
        goods_unit=units[0].goods_unit,
        goods_class=classes[0].goods_class,
        goods_brand=brands[0].goods_brand,
        goods_color=colors[0].goods_color,
        goods_shape=shapes[0].goods_shape,
        goods_specs=specs[0].goods_specs,
        goods_origin=origins[0].goods_origin,
        goods_cost=12.5,
        goods_price=24.0,
        creator=SYSTEM_CREATOR,
        bar_code=f"{tenant_tag}-BAR-001",
        openid=transaction_code,
    )
    goods_two = Goods.objects.create(
        goods_code=f"{tenant_tag}-SKU-002",
        goods_desc="Seeded reserve stock",
        goods_supplier=suppliers[1].supplier_name,
        goods_weight=6.0,
        goods_w=0.80,
        goods_d=0.50,
        goods_h=0.35,
        unit_volume=0.14,
        goods_unit=units[1].goods_unit,
        goods_class=classes[1].goods_class,
        goods_brand=brands[1].goods_brand,
        goods_color=colors[1].goods_color,
        goods_shape=shapes[1].goods_shape,
        goods_specs=specs[1].goods_specs,
        goods_origin=origins[1].goods_origin,
        goods_cost=16.0,
        goods_price=31.0,
        creator=SYSTEM_CREATOR,
        bar_code=f"{tenant_tag}-BAR-002",
        openid=transaction_code,
    )
    goods_three = Goods.objects.create(
        goods_code=f"{tenant_tag}-SKU-003",
        goods_desc="Seeded pick-face stock",
        goods_supplier=suppliers[2].supplier_name,
        goods_weight=1.2,
        goods_w=0.25,
        goods_d=0.20,
        goods_h=0.12,
        unit_volume=0.006,
        goods_unit=units[0].goods_unit,
        goods_class=classes[0].goods_class,
        goods_brand=brands[2].goods_brand,
        goods_color=colors[2].goods_color,
        goods_shape=shapes[0].goods_shape,
        goods_specs=specs[2].goods_specs,
        goods_origin=origins[2].goods_origin,
        goods_cost=4.0,
        goods_price=9.5,
        creator=SYSTEM_CREATOR,
        bar_code=f"{tenant_tag}-BAR-003",
        openid=transaction_code,
    )

    for location in (receiving_location, storage_a, storage_b, pick_face, quarantine_location):
        Scanner.objects.create(
            mode="LOCATION",
            code=location.location_code,
            bar_code=location.barcode,
            openid=transaction_code,
        )
    for goods in (goods_one, goods_two, goods_three):
        Scanner.objects.create(
            mode="GOODS",
            code=goods.goods_code,
            bar_code=goods.bar_code,
            openid=transaction_code,
        )

    for send_city, receiver_city in (
        ("New York", "Boston"),
        ("Boston", "New York"),
        ("New York", "Chicago"),
        ("Chicago", "New York"),
    ):
        TransportationFeeListModel.objects.create(
            send_city=send_city,
            receiver_city=receiver_city,
            weight_fee=12.5,
            volume_fee=135.0,
            min_payment=250.0,
            transportation_supplier=suppliers[0].supplier_name,
            creator=SYSTEM_CREATOR,
            openid=transaction_code,
        )

    record_inventory_movement(
        openid=transaction_code,
        operator_name=admin_staff.staff_name,
        warehouse=warehouse,
        goods=goods_one,
        movement_type=MovementType.OPENING,
        quantity=Decimal("120.0000"),
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="",
        serial_number="",
        unit_cost=Decimal("12.5000"),
        to_location=storage_a,
        reference_code=f"{tenant_tag}-OPEN-001",
        reason="Test system opening balance",
    )
    record_inventory_movement(
        openid=transaction_code,
        operator_name=admin_staff.staff_name,
        warehouse=warehouse,
        goods=goods_two,
        movement_type=MovementType.OPENING,
        quantity=Decimal("60.0000"),
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="",
        serial_number="",
        unit_cost=Decimal("16.0000"),
        to_location=storage_b,
        reference_code=f"{tenant_tag}-OPEN-002",
        reason="Test system opening balance",
    )
    record_inventory_movement(
        openid=transaction_code,
        operator_name=admin_staff.staff_name,
        warehouse=warehouse,
        goods=goods_three,
        movement_type=MovementType.OPENING,
        quantity=Decimal("24.0000"),
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="",
        serial_number="",
        unit_cost=Decimal("4.0000"),
        to_location=storage_a,
        reference_code=f"{tenant_tag}-OPEN-003",
        reason="Test system opening balance",
    )
    record_inventory_movement(
        openid=transaction_code,
        operator_name=admin_staff.staff_name,
        warehouse=warehouse,
        goods=goods_three,
        movement_type=MovementType.TRANSFER,
        quantity=Decimal("12.0000"),
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="",
        serial_number="",
        unit_cost=Decimal("4.0000"),
        from_location=storage_a,
        to_location=pick_face,
        reference_code=f"{tenant_tag}-TRN-001",
        reason="Seed pick-face replenishment",
    )
    pick_face_balance = InventoryBalance.objects.get(
        openid=transaction_code,
        location=pick_face,
        goods=goods_three,
        stock_status=InventoryStatus.AVAILABLE,
        lot_number="",
        serial_number="",
        is_delete=False,
    )
    create_inventory_hold(
        openid=transaction_code,
        operator_name=admin_staff.staff_name,
        inventory_balance=pick_face_balance,
        quantity=Decimal("2.0000"),
        reason="Seeded QA hold",
        reference_code=f"{tenant_tag}-HOLD-001",
        notes="Verifies the hold workflow across the stack.",
    )

    seed_summary = {
        "staff": Staff.objects.filter(openid=transaction_code, is_delete=False).count(),
        "warehouses": Warehouse.objects.filter(openid=transaction_code, is_delete=False).count(),
        "zones": Zone.objects.filter(openid=transaction_code, is_delete=False).count(),
        "location_types": LocationType.objects.filter(openid=transaction_code, is_delete=False).count(),
        "locations": Location.objects.filter(openid=transaction_code, is_delete=False).count(),
        "location_locks": LocationLock.objects.filter(openid=transaction_code, is_delete=False).count(),
        "suppliers": Supplier.objects.filter(openid=transaction_code, is_delete=False).count(),
        "customers": Customer.objects.filter(openid=transaction_code, is_delete=False).count(),
        "capitals": Capital.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_units": GoodsUnit.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_classes": GoodsClass.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_brands": GoodsBrand.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_colors": GoodsColor.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_shapes": GoodsShape.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_specs": GoodsSpecs.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods_origins": GoodsOrigin.objects.filter(openid=transaction_code, is_delete=False).count(),
        "goods": Goods.objects.filter(openid=transaction_code, is_delete=False).count(),
        "transportation_fees": TransportationFeeListModel.objects.filter(openid=transaction_code, is_delete=False).count(),
        "scanner_entries": Scanner.objects.filter(openid=transaction_code, is_delete=False).count(),
        "inventory_balances": InventoryBalance.objects.filter(openid=transaction_code, is_delete=False).count(),
        "inventory_movements": InventoryMovement.objects.filter(openid=transaction_code, is_delete=False).count(),
        "inventory_holds": InventoryHold.objects.filter(openid=transaction_code, is_delete=False).count(),
    }
    return BootstrapResult(
        auth_user=auth_user,
        profile=profile,
        admin_staff=admin_staff,
        seed_summary=seed_summary,
    )
