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
from scanner.models import GoodsScanRule, LicensePlate, LicensePlateStatus
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import AdvanceShipmentNotice, AdvanceShipmentNoticeLine, PurchaseOrder, PurchaseOrderLine, PurchaseOrderLineStatus, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus
from .views import AdvanceShipmentNoticeViewSet, PurchaseOrderViewSet, PutawayTaskViewSet, ReceiptViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Inbound Owner",
        "vip": 1,
        "openid": "inbound-openid",
        "appid": "inbound-appid",
        "t_code": "inbound-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Inbound Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "inbound-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Inbound Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "100 Dock St",
        "warehouse_contact": "555-0100",
        "warehouse_manager": "Inbound Lead",
        "creator": "creator",
        "openid": "inbound-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None)
    if warehouse is None:
        warehouse = create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "RCV",
        "zone_name": "Receiving",
        "usage": ZoneUsage.RECEIVING,
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
        "type_code": "RECV",
        "type_name": "Receiving Stage",
        "picking_enabled": False,
        "putaway_enabled": True,
        "allow_mixed_sku": True,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "inbound-openid",
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
    warehouse = overrides.pop("warehouse", None)
    if warehouse is None:
        warehouse = create_warehouse()
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
        "location_code": "RCV-01",
        "location_name": "Receiving Stage 01",
        "barcode": "RCV-01",
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


def create_supplier(**overrides: Any) -> Supplier:
    defaults = {
        "supplier_name": "Inbound Supplier",
        "supplier_city": "New York",
        "supplier_address": "20 Vendor Ave",
        "supplier_contact": "555-0200",
        "supplier_manager": "Supplier Lead",
        "creator": "creator",
        "openid": "inbound-openid",
    }
    defaults.update(overrides)
    return Supplier.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-IN-001",
        "goods_desc": "Inbound Widget",
        "goods_supplier": "Inbound Supplier",
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
        "bar_code": "BAR-IN-001",
        "openid": "inbound-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


def create_purchase_order(**overrides: Any) -> PurchaseOrder:
    warehouse = overrides.pop("warehouse", None)
    if warehouse is None:
        warehouse = create_warehouse()
    supplier = overrides.pop("supplier", None)
    if supplier is None:
        supplier = create_supplier(openid=warehouse.openid)
    defaults = {
        "warehouse": warehouse,
        "supplier": supplier,
        "po_number": "PO-001",
        "status": PurchaseOrderStatus.OPEN,
        "creator": "creator",
        "openid": warehouse.openid,
    }
    defaults.update(overrides)
    return PurchaseOrder.objects.create(**defaults)


def create_purchase_order_line(**overrides: Any) -> PurchaseOrderLine:
    purchase_order = overrides.pop("purchase_order", None)
    if purchase_order is None:
        purchase_order = create_purchase_order()
    goods = overrides.pop("goods", None)
    if goods is None:
        goods = create_goods(openid=purchase_order.openid)
    defaults = {
        "purchase_order": purchase_order,
        "line_number": 1,
        "goods": goods,
        "ordered_qty": Decimal("10.0000"),
        "received_qty": Decimal("0.0000"),
        "unit_cost": Decimal("5.0000"),
        "status": PurchaseOrderLineStatus.OPEN,
        "stock_status": "AVAILABLE",
        "creator": "creator",
        "openid": purchase_order.openid,
    }
    defaults.update(overrides)
    return PurchaseOrderLine.objects.create(**defaults)


class InboundApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="inbound-openid", appid="inbound-appid")
        self.user = get_user_model().objects.create_user(username="inbound-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.warehouse = create_warehouse()
        self.receiving_zone = create_zone(warehouse=self.warehouse, zone_code="RCV", zone_name="Receiving", usage=ZoneUsage.RECEIVING)
        self.storage_zone = create_zone(warehouse=self.warehouse, zone_code="STO", zone_name="Storage", usage=ZoneUsage.STORAGE)
        self.receiving_type = create_location_type(openid=self.warehouse.openid, type_code="RECV", type_name="Receiving Stage")
        self.storage_type = create_location_type(openid=self.warehouse.openid, type_code="PALLET", type_name="Pallet Rack", picking_enabled=True, putaway_enabled=True, allow_mixed_sku=False)
        self.receiving_location = create_location(
            warehouse=self.warehouse,
            zone=self.receiving_zone,
            location_type=self.receiving_type,
            location_code="RCV-01",
            location_name="Receiving Stage 01",
        )
        self.storage_location = create_location(
            warehouse=self.warehouse,
            zone=self.storage_zone,
            location_type=self.storage_type,
            location_code="STO-01",
            location_name="Storage Bin 01",
            barcode="STO-01",
        )
        self.supplier = create_supplier(openid=self.warehouse.openid)
        self.goods = create_goods(openid=self.warehouse.openid, goods_supplier=self.supplier.supplier_name)

    def test_purchase_order_create_generates_header_and_lines(self) -> None:
        view = PurchaseOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inbound/purchase-orders/",
            {
                "warehouse": self.warehouse.pk,
                "supplier": self.supplier.pk,
                "po_number": "PO-1001",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "ordered_qty": "15.0000",
                        "unit_cost": "3.5000",
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        purchase_order = PurchaseOrder.objects.get(po_number="PO-1001")
        self.assertEqual(purchase_order.creator, self.operator.staff_name)
        self.assertEqual(purchase_order.lines.count(), 1)
        self.assertEqual(purchase_order.lines.first().ordered_qty, Decimal("15.0000"))

    def test_receipt_create_updates_inventory_and_putaway_queue(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-2001")
        line = create_purchase_order_line(purchase_order=purchase_order, goods=self.goods, ordered_qty=Decimal("12.0000"))
        view = ReceiptViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inbound/receipts/",
            {
                "purchase_order": purchase_order.pk,
                "warehouse": self.warehouse.pk,
                "receipt_location": self.receiving_location.pk,
                "receipt_number": "RCPT-2001",
                "line_items": [
                    {
                        "purchase_order_line": line.pk,
                        "received_qty": "5.0000",
                        "unit_cost": "4.2500",
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)

        line.refresh_from_db()
        purchase_order.refresh_from_db()
        balance = InventoryBalance.objects.get(location=self.receiving_location, goods=self.goods)
        task = PutawayTask.objects.get(receipt_line__receipt__receipt_number="RCPT-2001")
        self.assertEqual(line.received_qty, Decimal("5.0000"))
        self.assertEqual(line.status, PurchaseOrderLineStatus.PARTIAL)
        self.assertEqual(purchase_order.status, PurchaseOrderStatus.PARTIAL)
        self.assertEqual(balance.on_hand_qty, Decimal("5.0000"))
        self.assertEqual(task.from_location_id, self.receiving_location.id)
        self.assertEqual(task.status, PutawayTaskStatus.OPEN)
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.RECEIPT).count(), 1)

    def test_putaway_complete_moves_stock_into_storage(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-3001")
        line = create_purchase_order_line(purchase_order=purchase_order, goods=self.goods, ordered_qty=Decimal("8.0000"))
        receipt_view = ReceiptViewSet.as_view({"post": "create"})
        receipt_request = self.factory.post(
            "/api/inbound/receipts/",
            {
                "purchase_order": purchase_order.pk,
                "warehouse": self.warehouse.pk,
                "receipt_location": self.receiving_location.pk,
                "receipt_number": "RCPT-3001",
                "line_items": [{"purchase_order_line": line.pk, "received_qty": "8.0000", "unit_cost": "4.5000"}],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(receipt_request, user=self.user, token=self.auth)
        receipt_response = receipt_view(receipt_request)
        self.assertEqual(receipt_response.status_code, 201)
        task = PutawayTask.objects.get(receipt_line__receipt__receipt_number="RCPT-3001")

        complete_view = PutawayTaskViewSet.as_view({"post": "complete"})
        complete_request = self.factory.post(
            f"/api/inbound/putaway-tasks/{task.pk}/complete/",
            {"to_location": self.storage_location.pk},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(complete_request, user=self.user, token=self.auth)
        response = complete_view(complete_request, pk=task.pk)
        self.assertEqual(response.status_code, 200)

        task.refresh_from_db()
        receiving_balance = InventoryBalance.objects.get(location=self.receiving_location, goods=self.goods)
        storage_balance = InventoryBalance.objects.get(location=self.storage_location, goods=self.goods)
        self.assertEqual(task.status, PutawayTaskStatus.COMPLETED)
        self.assertEqual(receiving_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(storage_balance.on_hand_qty, Decimal("8.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.PUTAWAY).count(), 1)

    def test_scan_receive_and_scan_putaway_complete_use_barcodes(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-SCAN-001")
        create_purchase_order_line(purchase_order=purchase_order, goods=self.goods, ordered_qty=Decimal("6.0000"))

        scan_receive_view = ReceiptViewSet.as_view({"post": "scan_receive"})
        scan_receive_request = self.factory.post(
            "/api/inbound/receipts/scan-receive/",
            {
                "purchase_order_number": purchase_order.po_number,
                "receipt_number": "RCPT-SCAN-001",
                "receipt_location_barcode": self.receiving_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "received_qty": "6.0000",
                "unit_cost": "4.7500",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_receive_request, user=self.user, token=self.auth)
        scan_receive_response = scan_receive_view(scan_receive_request)
        self.assertEqual(scan_receive_response.status_code, 201)
        task = PutawayTask.objects.get(receipt_line__receipt__receipt_number="RCPT-SCAN-001")
        self.assertEqual(task.status, PutawayTaskStatus.OPEN)

        scan_putaway_view = PutawayTaskViewSet.as_view({"post": "scan_complete"})
        scan_putaway_request = self.factory.post(
            "/api/inbound/putaway-tasks/scan-complete/",
            {
                "task_number": task.task_number,
                "from_location_barcode": self.receiving_location.barcode,
                "to_location_barcode": self.storage_location.barcode,
                "goods_barcode": self.goods.bar_code,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_putaway_request, user=self.user, token=self.auth)
        scan_putaway_response = scan_putaway_view(scan_putaway_request)
        self.assertEqual(scan_putaway_response.status_code, 200)

        task.refresh_from_db()
        receiving_balance = InventoryBalance.objects.get(location=self.receiving_location, goods=self.goods)
        storage_balance = InventoryBalance.objects.get(location=self.storage_location, goods=self.goods)
        self.assertEqual(task.status, PutawayTaskStatus.COMPLETED)
        self.assertEqual(receiving_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(storage_balance.on_hand_qty, Decimal("6.0000"))

    def test_scan_receive_supports_asn_lpn_and_attribute_parsing(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-ASN-001")
        purchase_order_line = create_purchase_order_line(purchase_order=purchase_order, goods=self.goods, ordered_qty=Decimal("4.0000"))
        asn_view = AdvanceShipmentNoticeViewSet.as_view({"post": "create"})
        asn_request = self.factory.post(
            "/api/inbound/advance-shipment-notices/",
            {
                "purchase_order": purchase_order.pk,
                "warehouse": self.warehouse.pk,
                "supplier": self.supplier.pk,
                "asn_number": "ASN-1001",
                "line_items": [
                    {
                        "line_number": 1,
                        "purchase_order_line": purchase_order_line.pk,
                        "goods": self.goods.pk,
                        "expected_qty": "4.0000",
                        "expected_lpn_code": "LPN-IN-001",
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(asn_request, user=self.user, token=self.auth)
        asn_response = asn_view(asn_request)
        self.assertEqual(asn_response.status_code, 201)
        GoodsScanRule.objects.create(
            goods=self.goods,
            requires_lot=True,
            lot_pattern=r"LOT-\d+",
            creator="creator",
            openid=self.warehouse.openid,
        )

        scan_receive_view = ReceiptViewSet.as_view({"post": "scan_receive"})
        scan_receive_request = self.factory.post(
            "/api/inbound/receipts/scan-receive/",
            {
                "asn_number": "ASN-1001",
                "receipt_number": "RCPT-ASN-001",
                "receipt_location_barcode": self.receiving_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "lpn_barcode": "LPN-IN-001",
                "attribute_scan": "LOT:LOT-100",
                "received_qty": "4.0000",
                "unit_cost": "4.2500",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_receive_request, user=self.user, token=self.auth)
        scan_receive_response = scan_receive_view(scan_receive_request)
        self.assertEqual(scan_receive_response.status_code, 201)

        receipt = AdvanceShipmentNotice.objects.get(asn_number="ASN-1001").receipts.get()
        receipt_line = receipt.lines.get()
        self.assertEqual(receipt_line.lot_number, "LOT-100")
        self.assertIsNotNone(receipt_line.license_plate)
        self.assertEqual(receipt_line.license_plate.status, LicensePlateStatus.RECEIVED)

        task = PutawayTask.objects.get(receipt_line=receipt_line)
        scan_putaway_view = PutawayTaskViewSet.as_view({"post": "scan_complete"})
        scan_putaway_request = self.factory.post(
            "/api/inbound/putaway-tasks/scan-complete/",
            {
                "task_number": task.task_number,
                "from_location_barcode": self.receiving_location.barcode,
                "to_location_barcode": self.storage_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "lpn_barcode": "LPN-IN-001",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_putaway_request, user=self.user, token=self.auth)
        scan_putaway_response = scan_putaway_view(scan_putaway_request)
        self.assertEqual(scan_putaway_response.status_code, 200)
        license_plate = LicensePlate.objects.get(lpn_code="LPN-IN-001")
        self.assertEqual(license_plate.status, LicensePlateStatus.STORED)
        self.assertEqual(license_plate.current_location_id, self.storage_location.id)
        asn_line = AdvanceShipmentNoticeLine.objects.get(asn__asn_number="ASN-1001", line_number=1)
        self.assertEqual(asn_line.received_qty, Decimal("4.0000"))

    def test_receipt_create_requires_inbound_authorization(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-4001")
        line = create_purchase_order_line(purchase_order=purchase_order, goods=self.goods)
        outbound_operator = create_staff(staff_name="Outbound Worker", staff_type="Outbound")
        view = ReceiptViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/inbound/receipts/",
            {
                "purchase_order": purchase_order.pk,
                "warehouse": self.warehouse.pk,
                "receipt_location": self.receiving_location.pk,
                "receipt_number": "RCPT-4001",
                "line_items": [{"purchase_order_line": line.pk, "received_qty": "1.0000"}],
            },
            format="json",
            HTTP_OPERATOR=str(outbound_operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_purchase_order_destroy_soft_deletes_when_no_receipts_exist(self) -> None:
        purchase_order = create_purchase_order(warehouse=self.warehouse, supplier=self.supplier, po_number="PO-5001")
        create_purchase_order_line(purchase_order=purchase_order, goods=self.goods)
        view = PurchaseOrderViewSet.as_view({"delete": "destroy"})
        request = self.factory.delete(
            f"/api/inbound/purchase-orders/{purchase_order.pk}/",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=purchase_order.pk)
        self.assertEqual(response.status_code, 200)
        purchase_order.refresh_from_db()
        self.assertTrue(purchase_order.is_delete)
        self.assertEqual(purchase_order.lines.filter(is_delete=True).count(), 1)


class InboundUrlsTests(TestCase):
    def test_reverses_use_expected_paths(self) -> None:
        self.assertEqual(reverse("inbound:advance-shipment-notice-list"), "/api/inbound/advance-shipment-notices/")
        self.assertEqual(reverse("inbound:purchase-order-list"), "/api/inbound/purchase-orders/")
        self.assertEqual(reverse("inbound:receipt-list"), "/api/inbound/receipts/")
        self.assertEqual(reverse("inbound:putaway-task-list"), "/api/inbound/putaway-tasks/")
        self.assertEqual(reverse("inbound:receipt-scan-receive"), "/api/inbound/receipts/scan-receive/")
        self.assertEqual(reverse("inbound:putaway-task-scan-complete"), "/api/inbound/putaway-tasks/scan-complete/")
        self.assertEqual(resolve("/api/inbound/purchase-orders/").url_name, "purchase-order-list")
