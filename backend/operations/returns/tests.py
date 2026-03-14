from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryMovement, MovementType
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from operations.outbound.models import SalesOrder
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import ReturnOrder, ReturnOrderStatus
from .views import ReturnDispositionViewSet, ReturnOrderViewSet, ReturnReceiptViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Returns Owner",
        "vip": 1,
        "openid": "returns-openid",
        "appid": "returns-appid",
        "t_code": "returns-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Returns Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "returns-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Returns Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "500 Return Rd",
        "warehouse_contact": "555-5500",
        "warehouse_manager": "Returns Lead",
        "creator": "creator",
        "openid": "returns-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "RET",
        "zone_name": "Returns",
        "usage": ZoneUsage.RETURNS,
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
        "type_code": "RET",
        "type_name": "Returns Stage",
        "picking_enabled": False,
        "putaway_enabled": True,
        "allow_mixed_sku": True,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "returns-openid",
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
        "location_code": "RET-01",
        "location_name": "Returns Stage 01",
        "barcode": "RET-01",
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


def create_customer(**overrides: Any) -> Customer:
    defaults = {
        "customer_name": "Returns Customer",
        "customer_city": "New York",
        "customer_address": "20 Customer Ave",
        "customer_contact": "555-2200",
        "customer_manager": "Customer Lead",
        "creator": "creator",
        "openid": "returns-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-RET-001",
        "goods_desc": "Return Widget",
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
        "bar_code": "BAR-RET-001",
        "openid": "returns-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class ReturnsApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="returns-openid", appid="returns-appid")
        self.user = get_user_model().objects.create_user(username="returns-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.viewer = create_staff(staff_name="Viewer", staff_type="Viewer", check_code=4321)
        self.warehouse = create_warehouse()
        self.returns_zone = create_zone(warehouse=self.warehouse, zone_code="RET", zone_name="Returns", usage=ZoneUsage.RETURNS)
        self.quarantine_zone = create_zone(warehouse=self.warehouse, zone_code="QTN", zone_name="Quarantine", usage=ZoneUsage.QUARANTINE, sequence=20)
        self.storage_zone = create_zone(warehouse=self.warehouse, zone_code="STO", zone_name="Storage", usage=ZoneUsage.STORAGE, sequence=30)
        self.returns_type = create_location_type(openid=self.warehouse.openid, type_code="RET", type_name="Returns Stage", picking_enabled=False)
        self.quarantine_type = create_location_type(openid=self.warehouse.openid, type_code="QTN", type_name="Quarantine Stage", picking_enabled=False)
        self.storage_type = create_location_type(openid=self.warehouse.openid, type_code="PALLET", type_name="Pallet Rack", picking_enabled=True)
        self.returns_location = create_location(
            warehouse=self.warehouse,
            zone=self.returns_zone,
            location_type=self.returns_type,
            location_code="RET-01",
            location_name="Returns Stage 01",
        )
        self.quarantine_location = create_location(
            warehouse=self.warehouse,
            zone=self.quarantine_zone,
            location_type=self.quarantine_type,
            location_code="QTN-01",
            location_name="Quarantine 01",
            barcode="QTN-01",
        )
        self.storage_location = create_location(
            warehouse=self.warehouse,
            zone=self.storage_zone,
            location_type=self.storage_type,
            location_code="STO-01",
            location_name="Storage 01",
            barcode="STO-01",
        )
        self.customer = create_customer(openid=self.warehouse.openid)
        self.goods = create_goods(openid=self.warehouse.openid)
        self.sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.returns_location,
            order_number="SO-RET-001",
            creator="creator",
            openid=self.warehouse.openid,
        )

    def _auth_request(self, request, operator: Staff) -> None:
        request.META["HTTP_OPERATOR"] = str(operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def _create_return_order(self, *, return_number: str = "RMA-1001") -> ReturnOrder:
        view = ReturnOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/returns/return-orders/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "sales_order": self.sales_order.pk,
                "return_number": return_number,
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "expected_qty": "3.0000",
                        "return_reason": "Damaged on delivery",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(request, self.operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        return ReturnOrder.objects.get(return_number=return_number)

    def test_return_order_create_generates_header_and_lines(self) -> None:
        return_order = self._create_return_order()
        self.assertEqual(return_order.status, ReturnOrderStatus.OPEN)
        self.assertEqual(return_order.lines.count(), 1)
        self.assertEqual(return_order.lines.get().expected_qty, Decimal("3.0000"))
        self.assertEqual(return_order.sales_order_id, self.sales_order.id)

    def test_return_receipt_and_restock_disposition_complete_order(self) -> None:
        return_order = self._create_return_order(return_number="RMA-2001")
        line = return_order.lines.get()

        receipt_view = ReturnReceiptViewSet.as_view({"post": "create"})
        receipt_request = self.factory.post(
            "/api/returns/receipts/",
            {
                "return_line": line.pk,
                "warehouse": self.warehouse.pk,
                "receipt_location": self.returns_location.pk,
                "receipt_number": "RTR-2001",
                "received_qty": "3.0000",
                "stock_status": "AVAILABLE",
            },
            format="json",
        )
        self._auth_request(receipt_request, self.operator)
        receipt_response = receipt_view(receipt_request)
        self.assertEqual(receipt_response.status_code, 201)

        disposition_view = ReturnDispositionViewSet.as_view({"post": "create"})
        disposition_request = self.factory.post(
            "/api/returns/dispositions/",
            {
                "return_receipt": receipt_response.data["id"],
                "warehouse": self.warehouse.pk,
                "disposition_number": "RTD-2001",
                "disposition_type": "RESTOCK",
                "quantity": "3.0000",
                "to_location": self.storage_location.pk,
            },
            format="json",
        )
        self._auth_request(disposition_request, self.operator)
        disposition_response = disposition_view(disposition_request)
        self.assertEqual(disposition_response.status_code, 201)

        return_order.refresh_from_db()
        line.refresh_from_db()
        returns_balance = InventoryBalance.objects.get(location=self.returns_location, goods=self.goods)
        storage_balance = InventoryBalance.objects.get(location=self.storage_location, goods=self.goods)
        self.assertEqual(return_order.status, ReturnOrderStatus.COMPLETED)
        self.assertEqual(line.disposed_qty, Decimal("3.0000"))
        self.assertEqual(returns_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(storage_balance.on_hand_qty, Decimal("3.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.RECEIPT).count(), 1)
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.TRANSFER).count(), 1)

    def test_damaged_return_can_be_scrapped(self) -> None:
        return_order = self._create_return_order(return_number="RMA-3001")
        line = return_order.lines.get()

        receipt_view = ReturnReceiptViewSet.as_view({"post": "create"})
        receipt_request = self.factory.post(
            "/api/returns/receipts/",
            {
                "return_line": line.pk,
                "warehouse": self.warehouse.pk,
                "receipt_location": self.quarantine_location.pk,
                "receipt_number": "RTR-3001",
                "received_qty": "1.0000",
                "stock_status": "DAMAGED",
            },
            format="json",
        )
        self._auth_request(receipt_request, self.operator)
        receipt_response = receipt_view(receipt_request)
        self.assertEqual(receipt_response.status_code, 201)

        disposition_view = ReturnDispositionViewSet.as_view({"post": "create"})
        disposition_request = self.factory.post(
            "/api/returns/dispositions/",
            {
                "return_receipt": receipt_response.data["id"],
                "warehouse": self.warehouse.pk,
                "disposition_number": "RTD-3001",
                "disposition_type": "SCRAP",
                "quantity": "1.0000",
            },
            format="json",
        )
        self._auth_request(disposition_request, self.operator)
        disposition_response = disposition_view(disposition_request)
        self.assertEqual(disposition_response.status_code, 201)

        return_order.refresh_from_db()
        line.refresh_from_db()
        quarantine_balance = InventoryBalance.objects.get(location=self.quarantine_location, goods=self.goods, stock_status="DAMAGED")
        self.assertEqual(return_order.status, ReturnOrderStatus.COMPLETED)
        self.assertEqual(line.disposed_qty, Decimal("1.0000"))
        self.assertEqual(quarantine_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.ADJUSTMENT_OUT).count(), 1)

    def test_permission_denies_unapproved_role(self) -> None:
        view = ReturnOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/returns/return-orders/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "return_number": "RMA-403",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "expected_qty": "1.0000",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(request, self.viewer)
        response = view(request)
        self.assertEqual(response.status_code, 403)


class ReturnsUrlsTests(TestCase):
    def test_routes_match_expected_paths(self) -> None:
        self.assertEqual(reverse("returns:return-order-list"), "/api/returns/return-orders/")
        self.assertEqual(reverse("returns:receipt-list"), "/api/returns/receipts/")
        self.assertEqual(reverse("returns:disposition-list"), "/api/returns/dispositions/")

    def test_views_resolve_correctly(self) -> None:
        self.assertEqual(resolve("/api/returns/return-orders/").view_name, "returns:return-order-list")
        self.assertEqual(resolve("/api/returns/receipts/").view_name, "returns:receipt-list")
        self.assertEqual(resolve("/api/returns/dispositions/").view_name, "returns:disposition-list")
