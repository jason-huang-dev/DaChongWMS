from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryHold, InventoryMovement, MovementType
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from scanner.models import GoodsScanRule, LicensePlate, LicensePlateStatus
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from operations.order_types import OperationOrderType

from .models import (
    DockLoadVerification,
    LogisticsTrackingEvent,
    LogisticsTrackingStatus,
    OutboundWave,
    OutboundWaveStatus,
    PackageExecutionRecord,
    PackageExecutionStatus,
    PackageExecutionStep,
    PickTask,
    PickTaskStatus,
    SalesOrder,
    SalesOrderExceptionState,
    SalesOrderFulfillmentStage,
    SalesOrderLineStatus,
    SalesOrderStatus,
    Shipment,
    ShipmentDocumentRecord,
    ShipmentDocumentType,
    ShortPickRecord,
    ShortPickStatus,
)
from .views import (
    DockLoadVerificationViewSet,
    LogisticsTrackingEventViewSet,
    OutboundWaveViewSet,
    PackageExecutionRecordViewSet,
    PickTaskViewSet,
    SalesOrderViewSet,
    ShipmentDocumentRecordViewSet,
    ShipmentViewSet,
    ShortPickRecordViewSet,
)


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Outbound Owner",
        "vip": 1,
        "openid": "outbound-openid",
        "appid": "outbound-appid",
        "t_code": "outbound-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Outbound Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "outbound-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Outbound Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "200 Ship St",
        "warehouse_contact": "555-1100",
        "warehouse_manager": "Outbound Lead",
        "creator": "creator",
        "openid": "outbound-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "PICK",
        "zone_name": "Picking",
        "usage": ZoneUsage.PICKING,
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
        "type_code": "PICK",
        "type_name": "Pick Face",
        "picking_enabled": True,
        "putaway_enabled": True,
        "allow_mixed_sku": False,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "outbound-openid",
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
        "location_code": "PICK-01",
        "location_name": "Pick Face 01",
        "barcode": "PICK-01",
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


def create_customer(**overrides: Any) -> Customer:
    defaults = {
        "customer_name": "Outbound Customer",
        "customer_city": "New York",
        "customer_address": "20 Customer Ave",
        "customer_contact": "555-2200",
        "customer_manager": "Customer Lead",
        "creator": "creator",
        "openid": "outbound-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-OUT-001",
        "goods_desc": "Outbound Widget",
        "goods_supplier": "Outbound Supplier",
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
        "bar_code": "BAR-OUT-001",
        "openid": "outbound-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class OutboundApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="outbound-openid", appid="outbound-appid")
        self.user = get_user_model().objects.create_user(username="outbound-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.warehouse = create_warehouse()
        self.picking_zone = create_zone(
            warehouse=self.warehouse,
            zone_code="PICK",
            zone_name="Picking",
            usage=ZoneUsage.PICKING,
        )
        self.shipping_zone = create_zone(
            warehouse=self.warehouse,
            zone_code="SHIP",
            zone_name="Shipping",
            usage=ZoneUsage.SHIPPING,
            sequence=20,
        )
        self.picking_type = create_location_type(
            openid=self.warehouse.openid,
            type_code="PICK",
            type_name="Pick Face",
            picking_enabled=True,
        )
        self.shipping_type = create_location_type(
            openid=self.warehouse.openid,
            type_code="SHIP",
            type_name="Shipping Lane",
            picking_enabled=False,
            allow_mixed_sku=True,
        )
        self.pick_location = create_location(
            warehouse=self.warehouse,
            zone=self.picking_zone,
            location_type=self.picking_type,
            location_code="PICK-01",
            location_name="Pick Face 01",
        )
        self.staging_location = create_location(
            warehouse=self.warehouse,
            zone=self.shipping_zone,
            location_type=self.shipping_type,
            location_code="SHIP-01",
            location_name="Shipping Lane 01",
            barcode="SHIP-01",
            is_pick_face=False,
        )
        self.customer = create_customer(openid=self.warehouse.openid)
        self.goods = create_goods(openid=self.warehouse.openid)
        self.source_balance = InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.pick_location,
            goods=self.goods,
            stock_status="AVAILABLE",
            lot_number="LOT-1",
            serial_number="",
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            creator="creator",
            openid=self.warehouse.openid,
        )

    def test_sales_order_create_generates_header_lines_and_catalog_fields(self) -> None:
        view = SalesOrderViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/outbound/sales-orders/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "staging_location": self.staging_location.pk,
                "order_number": "SO-1001",
                "order_time": "2026-03-21T08:30:00Z",
                "expires_at": "2026-03-25T00:00:00Z",
                "package_count": 2,
                "package_type": "Carton",
                "package_weight": "12.5000",
                "package_length": "40.0000",
                "package_width": "30.0000",
                "package_height": "20.0000",
                "package_volume": "0.0240",
                "logistics_provider": "SF Express",
                "shipping_method": "Air Priority",
                "tracking_number": "TRK-1001",
                "waybill_number": "WB-1001",
                "waybill_printed": True,
                "deliverer_name": "WMS Dispatch",
                "deliverer_phone": "555-8800",
                "receiver_name": "Client Receiver",
                "receiver_phone": "555-7700",
                "receiver_country": "US",
                "receiver_state": "NY",
                "receiver_city": "New York",
                "receiver_address": "1 Customer Plaza",
                "receiver_postal_code": "10001",
                "exception_state": SalesOrderExceptionState.NORMAL,
                "exception_notes": "",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "ordered_qty": "5.0000",
                        "unit_price": "9.5000",
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        sales_order = SalesOrder.objects.get(order_number="SO-1001")
        self.assertEqual(sales_order.creator, self.operator.staff_name)
        self.assertEqual(sales_order.lines.count(), 1)
        self.assertEqual(sales_order.lines.first().ordered_qty, Decimal("5.0000"))
        self.assertEqual(sales_order.fulfillment_stage, SalesOrderFulfillmentStage.TO_MOVE)
        self.assertEqual(sales_order.package_count, 2)
        self.assertEqual(sales_order.package_weight, Decimal("12.5000"))
        self.assertEqual(sales_order.logistics_provider, "SF Express")
        self.assertEqual(sales_order.shipping_method, "Air Priority")
        self.assertEqual(sales_order.tracking_number, "TRK-1001")
        self.assertTrue(sales_order.waybill_printed)
        self.assertIsNotNone(sales_order.waybill_printed_at)
        self.assertEqual(sales_order.receiver_name, "Client Receiver")
        self.assertEqual(sales_order.deliverer_name, "WMS Dispatch")

    def test_allocate_complete_pick_and_ship_updates_inventory(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-2001",
            tracking_number="TRK-2001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("4.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        allocate_response = allocate_view(allocate_request, pk=sales_order.pk)
        self.assertEqual(allocate_response.status_code, 200)

        sales_order.refresh_from_db()
        order_line = sales_order.lines.get()
        pick_task = PickTask.objects.get(sales_order_line=order_line)
        self.source_balance.refresh_from_db()
        self.assertEqual(sales_order.status, SalesOrderStatus.ALLOCATED)
        self.assertEqual(order_line.status, SalesOrderLineStatus.ALLOCATED)
        self.assertEqual(sales_order.fulfillment_stage, SalesOrderFulfillmentStage.IN_PROCESS)
        self.assertIsNotNone(sales_order.picking_started_at)
        self.assertEqual(self.source_balance.allocated_qty, Decimal("4.0000"))
        self.assertEqual(pick_task.status, PickTaskStatus.OPEN)

        complete_view = PickTaskViewSet.as_view({"post": "complete"})
        complete_request = self.factory.post(
            f"/api/outbound/pick-tasks/{pick_task.pk}/complete/",
            {"to_location": self.staging_location.pk},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(complete_request, user=self.user, token=self.auth)
        complete_response = complete_view(complete_request, pk=pick_task.pk)
        self.assertEqual(complete_response.status_code, 200)

        sales_order.refresh_from_db()
        order_line.refresh_from_db()
        pick_task.refresh_from_db()
        self.source_balance.refresh_from_db()
        staging_balance = InventoryBalance.objects.get(location=self.staging_location, goods=self.goods)
        self.assertEqual(pick_task.status, PickTaskStatus.COMPLETED)
        self.assertEqual(sales_order.status, SalesOrderStatus.PICKED)
        self.assertEqual(order_line.status, SalesOrderLineStatus.PICKED)
        self.assertEqual(sales_order.fulfillment_stage, SalesOrderFulfillmentStage.IN_PROCESS)
        self.assertIsNotNone(sales_order.picking_completed_at)
        self.assertEqual(self.source_balance.on_hand_qty, Decimal("6.0000"))
        self.assertEqual(self.source_balance.allocated_qty, Decimal("0.0000"))
        self.assertEqual(staging_balance.on_hand_qty, Decimal("4.0000"))
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.PICK).count(), 1)

        pack_view = SalesOrderViewSet.as_view({"patch": "partial_update"})
        packed_at = timezone.now().replace(microsecond=0)
        pack_request = self.factory.patch(
            f"/api/outbound/sales-orders/{sales_order.pk}/",
            {"packed_at": packed_at.isoformat()},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(pack_request, user=self.user, token=self.auth)
        pack_response = pack_view(pack_request, pk=sales_order.pk)
        self.assertEqual(pack_response.status_code, 200)

        sales_order.refresh_from_db()
        self.assertEqual(sales_order.fulfillment_stage, SalesOrderFulfillmentStage.TO_SHIP)
        self.assertIsNotNone(sales_order.packed_at)

        shipment_view = ShipmentViewSet.as_view({"post": "create"})
        shipment_request = self.factory.post(
            "/api/outbound/shipments/",
            {
                "sales_order": sales_order.pk,
                "warehouse": self.warehouse.pk,
                "staging_location": self.staging_location.pk,
                "shipment_number": "SHIP-2001",
                "line_items": [
                    {
                        "sales_order_line": order_line.pk,
                        "shipped_qty": "4.0000",
                        "stock_status": "AVAILABLE",
                        "lot_number": "LOT-1",
                        "serial_number": "",
                        "from_location": self.staging_location.pk,
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(shipment_request, user=self.user, token=self.auth)
        shipment_response = shipment_view(shipment_request)
        self.assertEqual(shipment_response.status_code, 201)

        sales_order.refresh_from_db()
        order_line.refresh_from_db()
        staging_balance.refresh_from_db()
        shipment = Shipment.objects.get(shipment_number="SHIP-2001")
        self.assertEqual(sales_order.status, SalesOrderStatus.SHIPPED)
        self.assertEqual(sales_order.fulfillment_stage, SalesOrderFulfillmentStage.SHIPPED)
        self.assertEqual(order_line.status, SalesOrderLineStatus.SHIPPED)
        self.assertEqual(order_line.picked_qty, Decimal("0.0000"))
        self.assertEqual(order_line.shipped_qty, Decimal("4.0000"))
        self.assertEqual(staging_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(shipment.lines.count(), 1)
        self.assertEqual(InventoryMovement.objects.filter(movement_type=MovementType.SHIP).count(), 1)

    def test_scan_pick_and_scan_ship_use_barcodes(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-SCAN-001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        order_line = sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("3.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        allocate_response = allocate_view(allocate_request, pk=sales_order.pk)
        self.assertEqual(allocate_response.status_code, 200)
        pick_task = PickTask.objects.get(sales_order_line=order_line)

        scan_pick_view = PickTaskViewSet.as_view({"post": "scan_complete"})
        scan_pick_request = self.factory.post(
            "/api/outbound/pick-tasks/scan-complete/",
            {
                "task_number": pick_task.task_number,
                "from_location_barcode": self.pick_location.barcode,
                "to_location_barcode": self.staging_location.barcode,
                "goods_barcode": self.goods.bar_code,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_pick_request, user=self.user, token=self.auth)
        scan_pick_response = scan_pick_view(scan_pick_request)
        self.assertEqual(scan_pick_response.status_code, 200)

        scan_ship_view = ShipmentViewSet.as_view({"post": "scan_ship"})
        scan_ship_request = self.factory.post(
            "/api/outbound/shipments/scan-ship/",
            {
                "sales_order_number": sales_order.order_number,
                "shipment_number": "SHIP-SCAN-001",
                "staging_location_barcode": self.staging_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "shipped_qty": "3.0000",
                "stock_status": "AVAILABLE",
                "lot_number": "LOT-1",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_ship_request, user=self.user, token=self.auth)
        scan_ship_response = scan_ship_view(scan_ship_request)
        self.assertEqual(scan_ship_response.status_code, 201)

        sales_order.refresh_from_db()
        order_line.refresh_from_db()
        staging_balance = InventoryBalance.objects.get(location=self.staging_location, goods=self.goods)
        shipment = Shipment.objects.get(shipment_number="SHIP-SCAN-001")
        self.assertEqual(sales_order.status, SalesOrderStatus.SHIPPED)
        self.assertEqual(order_line.status, SalesOrderLineStatus.SHIPPED)
        self.assertEqual(staging_balance.on_hand_qty, Decimal("0.0000"))
        self.assertEqual(shipment.lines.count(), 1)

    def test_scan_ship_supports_lpn_attribute_parsing_and_dock_load_verification(self) -> None:
        dock_location = create_location(
            warehouse=self.warehouse,
            zone=self.shipping_zone,
            location_type=self.shipping_type,
            location_code="DOCK-01",
            location_name="Dock Door 01",
            barcode="DOCK-01",
            is_pick_face=False,
        )
        GoodsScanRule.objects.create(
            goods=self.goods,
            requires_lot=True,
            lot_pattern=r"LOT-\d+",
            creator="creator",
            openid=self.warehouse.openid,
        )
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-LPN-001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        order_line = sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("3.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )
        license_plate = LicensePlate.objects.create(
            warehouse=self.warehouse,
            goods=self.goods,
            current_location=self.pick_location,
            lpn_code="LPN-OUT-001",
            quantity=Decimal("3.0000"),
            lot_number="LOT-1",
            status=LicensePlateStatus.RECEIVED,
            creator="creator",
            openid=self.warehouse.openid,
        )

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        self.assertEqual(allocate_view(allocate_request, pk=sales_order.pk).status_code, 200)
        pick_task = PickTask.objects.get(sales_order_line=order_line)

        scan_pick_view = PickTaskViewSet.as_view({"post": "scan_complete"})
        scan_pick_request = self.factory.post(
            "/api/outbound/pick-tasks/scan-complete/",
            {
                "task_number": pick_task.task_number,
                "from_location_barcode": self.pick_location.barcode,
                "to_location_barcode": self.staging_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "lpn_barcode": license_plate.lpn_code,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_pick_request, user=self.user, token=self.auth)
        self.assertEqual(scan_pick_view(scan_pick_request).status_code, 200)
        license_plate.refresh_from_db()
        self.assertEqual(license_plate.status, LicensePlateStatus.STAGED)
        self.assertEqual(license_plate.current_location_id, self.staging_location.id)

        scan_ship_view = ShipmentViewSet.as_view({"post": "scan_ship"})
        scan_ship_request = self.factory.post(
            "/api/outbound/shipments/scan-ship/",
            {
                "sales_order_number": sales_order.order_number,
                "shipment_number": "SHIP-LPN-001",
                "staging_location_barcode": self.staging_location.barcode,
                "dock_location_barcode": dock_location.barcode,
                "goods_barcode": self.goods.bar_code,
                "lpn_barcode": license_plate.lpn_code,
                "attribute_scan": "LOT:LOT-1",
                "shipped_qty": "3.0000",
                "stock_status": "AVAILABLE",
                "trailer_reference": "TRAILER-77",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scan_ship_request, user=self.user, token=self.auth)
        scan_ship_response = scan_ship_view(scan_ship_request)
        self.assertEqual(scan_ship_response.status_code, 201)

        shipment = Shipment.objects.get(shipment_number="SHIP-LPN-001")
        dock_verification = DockLoadVerification.objects.get(shipment=shipment)
        license_plate.refresh_from_db()
        self.assertEqual(license_plate.status, LicensePlateStatus.LOADED)
        self.assertEqual(license_plate.current_location_id, dock_location.id)
        self.assertEqual(dock_verification.dock_location_id, dock_location.id)
        self.assertEqual(dock_verification.trailer_reference, "TRAILER-77")

    def test_sales_order_create_accepts_b2b_partition_and_list_filters_it(self) -> None:
        create_view = SalesOrderViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/outbound/sales-orders/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "staging_location": self.staging_location.pk,
                "order_type": OperationOrderType.B2B,
                "order_number": "SO-B2B-1001",
                "line_items": [
                    {
                        "line_number": 1,
                        "goods": self.goods.pk,
                        "ordered_qty": "4.0000",
                        "unit_price": "10.0000",
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(create_request, user=self.user, token=self.auth)
        create_response = create_view(create_request)
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["order_type"], OperationOrderType.B2B)

        SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number="SO-DROPSHIP-1001",
            creator="creator",
            openid=self.warehouse.openid,
        )

        list_view = SalesOrderViewSet.as_view({"get": "list"})
        list_request = self.factory.get(
            "/api/outbound/sales-orders/",
            {"order_type": OperationOrderType.B2B},
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(list_request, user=self.user, token=self.auth)
        list_response = list_view(list_request)

        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data["count"], 1)
        self.assertEqual(list_response.data["results"][0]["order_number"], "SO-B2B-1001")
        self.assertEqual(list_response.data["results"][0]["order_type"], OperationOrderType.B2B)

    def test_allocate_ignores_locked_or_non_pickable_locations(self) -> None:
        blocked_pick_type = create_location_type(
            openid=self.warehouse.openid,
            type_code="BULK",
            type_name="Bulk Storage",
            picking_enabled=False,
        )
        blocked_location = create_location(
            warehouse=self.warehouse,
            zone=self.picking_zone,
            location_type=blocked_pick_type,
            location_code="BULK-01",
            location_name="Bulk 01",
            is_pick_face=False,
            is_locked=True,
        )
        InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=blocked_location,
            goods=self.goods,
            stock_status="AVAILABLE",
            lot_number="LOT-2",
            serial_number="",
            on_hand_qty=Decimal("20.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("4.5000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-3001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        order_line = sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("7.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        response = allocate_view(allocate_request, pk=sales_order.pk)
        self.assertEqual(response.status_code, 200)

        pick_task = PickTask.objects.get(sales_order_line=order_line)
        self.assertEqual(pick_task.from_location_id, self.pick_location.id)

    def test_report_short_pick_creates_explicit_record_and_inventory_hold(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-3002",
            creator="creator",
            openid=self.warehouse.openid,
        )
        sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("4.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        self.assertEqual(allocate_view(allocate_request, pk=sales_order.pk).status_code, 200)

        pick_task = PickTask.objects.get(sales_order_line__sales_order=sales_order)
        short_pick_view = PickTaskViewSet.as_view({"post": "report_short_pick"})
        short_pick_request = self.factory.post(
            f"/api/outbound/pick-tasks/{pick_task.pk}/report-short-pick/",
            {
                "short_qty": "2.0000",
                "picked_qty": "2.0000",
                "reason_code": "LOCATION_EMPTY",
                "to_location": self.staging_location.pk,
                "notes": "Pick face did not contain the expected stock.",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(short_pick_request, user=self.user, token=self.auth)
        response = short_pick_view(short_pick_request, pk=pick_task.pk)
        self.assertEqual(response.status_code, 201)

        record = ShortPickRecord.objects.get(pk=response.data["id"])
        self.source_balance.refresh_from_db()
        sales_order.refresh_from_db()
        order_line = sales_order.lines.get()
        pick_task.refresh_from_db()
        self.assertEqual(record.status, ShortPickStatus.OPEN)
        self.assertEqual(record.short_qty, Decimal("2.0000"))
        self.assertEqual(record.picked_qty, Decimal("2.0000"))
        self.assertEqual(pick_task.status, PickTaskStatus.COMPLETED)
        self.assertEqual(order_line.picked_qty, Decimal("2.0000"))
        self.assertEqual(order_line.allocated_qty, Decimal("0.0000"))
        self.assertEqual(self.source_balance.hold_qty, Decimal("2.0000"))
        self.assertTrue(InventoryHold.objects.filter(reference_code=pick_task.task_number, is_active=True).exists())
        self.assertEqual(sales_order.status, SalesOrderStatus.PICKING)
        self.assertEqual(sales_order.exception_state, SalesOrderExceptionState.ABNORMAL_PACKAGE)

    def test_resolve_short_pick_marks_record_resolved(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-3003",
            creator="creator",
            openid=self.warehouse.openid,
        )
        line = sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("3.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )
        pick_task = PickTask.objects.create(
            sales_order_line=line,
            warehouse=self.warehouse,
            goods=self.goods,
            task_number="PICK-SHORT-001",
            from_location=self.pick_location,
            to_location=self.staging_location,
            quantity=Decimal("3.0000"),
            stock_status="AVAILABLE",
            status=PickTaskStatus.OPEN,
            creator="creator",
            openid=self.warehouse.openid,
        )
        record = ShortPickRecord.objects.create(
            warehouse=self.warehouse,
            sales_order=sales_order,
            sales_order_line=line,
            pick_task=pick_task,
            goods=self.goods,
            from_location=self.pick_location,
            to_location=self.staging_location,
            requested_qty=Decimal("3.0000"),
            picked_qty=Decimal("0.0000"),
            short_qty=Decimal("3.0000"),
            stock_status="AVAILABLE",
            reason_code="COUNT_REQUIRED",
            notes="Count required before replenishment.",
            reported_by=self.operator.staff_name,
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        sales_order.exception_state = SalesOrderExceptionState.ABNORMAL_PACKAGE
        sales_order.save(update_fields=["exception_state", "update_time"])

        resolve_view = ShortPickRecordViewSet.as_view({"post": "resolve"})
        resolve_request = self.factory.post(
            f"/api/outbound/short-picks/{record.pk}/resolve/",
            {"resolution_notes": "Cycle count completed and replenishment queued."},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(resolve_request, user=self.user, token=self.auth)
        response = resolve_view(resolve_request, pk=record.pk)
        self.assertEqual(response.status_code, 200)
        record.refresh_from_db()
        sales_order.refresh_from_db()
        self.assertEqual(record.status, ShortPickStatus.RESOLVED)
        self.assertEqual(record.resolved_by, self.operator.staff_name)
        self.assertEqual(sales_order.exception_state, SalesOrderExceptionState.NORMAL)

    def test_generate_wave_pack_documents_and_tracking_records(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-WAVE-001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        order_line = sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("2.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )

        wave_view = OutboundWaveViewSet.as_view({"post": "create"})
        wave_request = self.factory.post(
            "/api/outbound/waves/",
            {
                "warehouse": self.warehouse.pk,
                "wave_number": "WAVE-001",
                "sales_order_ids": [sales_order.pk],
                "notes": "AM shift batch",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(wave_request, user=self.user, token=self.auth)
        wave_response = wave_view(wave_request)
        self.assertEqual(wave_response.status_code, 201)
        wave = OutboundWave.objects.get(wave_number="WAVE-001")
        self.assertEqual(wave.status, OutboundWaveStatus.OPEN)
        self.assertEqual(wave.orders.count(), 1)

        allocate_view = SalesOrderViewSet.as_view({"post": "allocate"})
        allocate_request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(allocate_request, user=self.user, token=self.auth)
        self.assertEqual(allocate_view(allocate_request, pk=sales_order.pk).status_code, 200)
        pick_task = PickTask.objects.get(sales_order_line=order_line)

        complete_view = PickTaskViewSet.as_view({"post": "complete"})
        complete_request = self.factory.post(
            f"/api/outbound/pick-tasks/{pick_task.pk}/complete/",
            {"to_location": self.staging_location.pk},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(complete_request, user=self.user, token=self.auth)
        self.assertEqual(complete_view(complete_request, pk=pick_task.pk).status_code, 200)

        package_view = PackageExecutionRecordViewSet.as_view({"post": "create"})
        package_request = self.factory.post(
            "/api/outbound/package-executions/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "wave": wave.pk,
                "record_number": "PACK-001",
                "step_type": PackageExecutionStep.PACK,
                "execution_status": PackageExecutionStatus.SUCCESS,
                "package_number": "PKG-001",
                "scan_code": "PKG-001",
                "notes": "Packed on station 2",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(package_request, user=self.user, token=self.auth)
        package_response = package_view(package_request)
        self.assertEqual(package_response.status_code, 201)

        weigh_request = self.factory.post(
            "/api/outbound/package-executions/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "record_number": "WEIGH-001",
                "step_type": PackageExecutionStep.WEIGH,
                "execution_status": PackageExecutionStatus.SUCCESS,
                "package_number": "PKG-001",
                "weight": "3.2500",
                "notes": "Ready to ship",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(weigh_request, user=self.user, token=self.auth)
        weigh_response = package_view(weigh_request)
        self.assertEqual(weigh_response.status_code, 201)

        shipment_view = ShipmentViewSet.as_view({"post": "create"})
        shipment_request = self.factory.post(
            "/api/outbound/shipments/",
            {
                "sales_order": sales_order.pk,
                "warehouse": self.warehouse.pk,
                "staging_location": self.staging_location.pk,
                "shipment_number": "SHIP-WAVE-001",
                "line_items": [
                    {
                        "sales_order_line": order_line.pk,
                        "shipped_qty": "2.0000",
                        "stock_status": "AVAILABLE",
                        "lot_number": "LOT-1",
                        "serial_number": "",
                        "from_location": self.staging_location.pk,
                    }
                ],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(shipment_request, user=self.user, token=self.auth)
        shipment_response = shipment_view(shipment_request)
        self.assertEqual(shipment_response.status_code, 201)
        shipment = Shipment.objects.get(shipment_number="SHIP-WAVE-001")

        document_view = ShipmentDocumentRecordViewSet.as_view({"post": "create"})
        manifest_request = self.factory.post(
            "/api/outbound/shipment-documents/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "shipment": shipment.pk,
                "wave": wave.pk,
                "document_number": "DOC-001",
                "document_type": ShipmentDocumentType.MANIFEST,
                "reference_code": "MAN-001",
                "file_name": "manifest-001.pdf",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(manifest_request, user=self.user, token=self.auth)
        self.assertEqual(document_view(manifest_request).status_code, 201)

        scanform_request = self.factory.post(
            "/api/outbound/shipment-documents/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "document_number": "DOC-002",
                "document_type": ShipmentDocumentType.SCANFORM,
                "reference_code": "SCAN-001",
                "file_name": "scanform-001.pdf",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(scanform_request, user=self.user, token=self.auth)
        self.assertEqual(document_view(scanform_request).status_code, 201)

        tracking_view = LogisticsTrackingEventViewSet.as_view({"post": "create"})
        tracking_request = self.factory.post(
            "/api/outbound/tracking-events/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "shipment": shipment.pk,
                "event_number": "TRACK-001",
                "tracking_number": "TRK-WAVE-001",
                "event_code": "IN_TRANSIT",
                "event_status": LogisticsTrackingStatus.IN_TRANSIT,
                "event_location": "JFK Hub",
                "description": "Left origin sort center",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(tracking_request, user=self.user, token=self.auth)
        self.assertEqual(tracking_view(tracking_request).status_code, 201)

        sales_order.refresh_from_db()
        self.assertEqual(PackageExecutionRecord.objects.count(), 2)
        self.assertEqual(ShipmentDocumentRecord.objects.count(), 2)
        self.assertEqual(LogisticsTrackingEvent.objects.count(), 1)
        self.assertEqual(sales_order.package_weight, Decimal("3.2500"))
        self.assertIsNotNone(sales_order.packed_at)
        self.assertTrue(sales_order.waybill_printed)
        self.assertEqual(sales_order.tracking_number, "TRK-WAVE-001")

    def test_generate_wave_rejects_mixed_order_types_and_sets_partition(self) -> None:
        b2b_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_type=OperationOrderType.B2B,
            order_number="SO-B2B-WAVE-001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        dropship_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_type=OperationOrderType.DROPSHIP,
            order_number="SO-DROP-WAVE-001",
            creator="creator",
            openid=self.warehouse.openid,
        )

        wave_view = OutboundWaveViewSet.as_view({"post": "create"})
        mixed_request = self.factory.post(
            "/api/outbound/waves/",
            {
                "warehouse": self.warehouse.pk,
                "wave_number": "WAVE-MIXED-001",
                "sales_order_ids": [b2b_order.pk, dropship_order.pk],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(mixed_request, user=self.user, token=self.auth)
        mixed_response = wave_view(mixed_request)
        self.assertEqual(mixed_response.status_code, 400)
        self.assertIn("cannot mix sales order types", str(mixed_response.data["detail"]).lower())
        self.assertFalse(OutboundWave.objects.filter(wave_number="WAVE-MIXED-001").exists())

        b2b_request = self.factory.post(
            "/api/outbound/waves/",
            {
                "warehouse": self.warehouse.pk,
                "wave_number": "WAVE-B2B-001",
                "sales_order_ids": [b2b_order.pk],
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(b2b_request, user=self.user, token=self.auth)
        b2b_response = wave_view(b2b_request)
        self.assertEqual(b2b_response.status_code, 201)
        wave = OutboundWave.objects.get(wave_number="WAVE-B2B-001")
        self.assertEqual(wave.order_type, OperationOrderType.B2B)

    def test_record_package_relabel_step(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-RELABEL-001",
            creator="creator",
            openid=self.warehouse.openid,
        )

        package_view = PackageExecutionRecordViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/outbound/package-executions/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "record_number": "RELABEL-001",
                "step_type": PackageExecutionStep.RELABEL,
                "execution_status": PackageExecutionStatus.SUCCESS,
                "package_number": "PKG-RELABEL-001",
                "scan_code": "LBL-NEW-001",
                "notes": "Applied marketplace relabel.",
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = package_view(request)

        self.assertEqual(response.status_code, 201)
        record = PackageExecutionRecord.objects.get(record_number="RELABEL-001")
        self.assertEqual(record.step_type, PackageExecutionStep.RELABEL)
        sales_order.refresh_from_db()
        self.assertIsNone(sales_order.packed_at)

    def test_package_execution_rejects_mismatched_partition_request(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_type=OperationOrderType.B2B,
            order_number="SO-B2B-PACK-001",
            creator="creator",
            openid=self.warehouse.openid,
        )

        package_view = PackageExecutionRecordViewSet.as_view({"post": "create"})
        mismatched_request = self.factory.post(
            "/api/outbound/package-executions/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "record_number": "PACK-MISMATCH-001",
                "step_type": PackageExecutionStep.PACK,
                "execution_status": PackageExecutionStatus.SUCCESS,
                "package_number": "PKG-B2B-001",
                "requested_order_type": OperationOrderType.STANDARD,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(mismatched_request, user=self.user, token=self.auth)
        mismatched_response = package_view(mismatched_request)
        self.assertEqual(mismatched_response.status_code, 400)
        self.assertIn("STANDARD partition", str(mismatched_response.data["detail"]))

        valid_request = self.factory.post(
            "/api/outbound/package-executions/",
            {
                "warehouse": self.warehouse.pk,
                "sales_order": sales_order.pk,
                "record_number": "PACK-B2B-001",
                "step_type": PackageExecutionStep.PACK,
                "execution_status": PackageExecutionStatus.SUCCESS,
                "package_number": "PKG-B2B-001",
                "requested_order_type": OperationOrderType.B2B,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(valid_request, user=self.user, token=self.auth)
        valid_response = package_view(valid_request)
        self.assertEqual(valid_response.status_code, 201)
        self.assertEqual(PackageExecutionRecord.objects.get(record_number="PACK-B2B-001").sales_order_id, sales_order.id)

    def test_allocate_requires_outbound_authorization(self) -> None:
        sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.staging_location,
            order_number="SO-4001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        sales_order.lines.create(
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("2.0000"),
            unit_price=Decimal("10.0000"),
            stock_status="AVAILABLE",
            creator="creator",
            openid=self.warehouse.openid,
        )
        inbound_operator = create_staff(staff_name="Inbound Worker", staff_type="Inbound")
        view = SalesOrderViewSet.as_view({"post": "allocate"})
        request = self.factory.post(
            f"/api/outbound/sales-orders/{sales_order.pk}/allocate/",
            {},
            format="json",
            HTTP_OPERATOR=str(inbound_operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=sales_order.pk)
        self.assertEqual(response.status_code, 403)


class OutboundUrlsTests(TestCase):
    def test_reverses_use_expected_paths(self) -> None:
        self.assertEqual(reverse("outbound:sales-order-list"), "/api/outbound/sales-orders/")
        self.assertEqual(reverse("outbound:pick-task-list"), "/api/outbound/pick-tasks/")
        self.assertEqual(reverse("outbound:shipment-list"), "/api/outbound/shipments/")
        self.assertEqual(reverse("outbound:wave-list"), "/api/outbound/waves/")
        self.assertEqual(reverse("outbound:package-execution-list"), "/api/outbound/package-executions/")
        self.assertEqual(reverse("outbound:shipment-document-list"), "/api/outbound/shipment-documents/")
        self.assertEqual(reverse("outbound:tracking-event-list"), "/api/outbound/tracking-events/")
        self.assertEqual(reverse("outbound:dock-load-verification-list"), "/api/outbound/dock-load-verifications/")
        self.assertEqual(reverse("outbound:short-pick-list"), "/api/outbound/short-picks/")
        self.assertEqual(reverse("outbound:pick-task-scan-complete"), "/api/outbound/pick-tasks/scan-complete/")
        self.assertEqual(reverse("outbound:shipment-scan-ship"), "/api/outbound/shipments/scan-ship/")
        self.assertEqual(reverse("outbound:pick-task-report-short-pick", kwargs={"pk": 1}), "/api/outbound/pick-tasks/1/report-short-pick/")
        self.assertEqual(reverse("outbound:short-pick-resolve", kwargs={"pk": 1}), "/api/outbound/short-picks/1/resolve/")
        self.assertEqual(resolve("/api/outbound/sales-orders/").url_name, "sales-order-list")
