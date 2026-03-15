from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import APIException
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryStatus
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from operations.inbound.models import PutawayTask, Receipt
from operations.inbound.services import PurchaseOrderLinePayload, create_purchase_order
from operations.outbound.models import PickTask, PickTaskStatus, Shipment
from operations.outbound.services import SalesOrderLinePayload, allocate_sales_order, create_sales_order
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from warehouse.models import Warehouse

from scanner.services import DeviceSessionPayload, start_handheld_device_session, transition_license_plate, upsert_license_plate_receipt
from utils.scanning import (
    resolve_and_validate_scan_attributes,
    resolve_goods_by_scan_code,
    resolve_license_plate_by_scan_code,
    resolve_location_by_scan_code,
)

from .models import (
    AliasTargetType,
    BarcodeAlias,
    GoodsScanRule,
    HandheldDeviceSession,
    HandheldDeviceSessionStatus,
    HandheldTelemetrySample,
    LicensePlateStatus,
    ListModel,
    OfflineReplayBatchStatus,
    OfflineReplayEventStatus,
    OfflineReplayEventType,
)
from .views import HandheldDeviceSessionViewSet, HandheldTelemetrySampleViewSet, OfflineReplayBatchViewSet


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


def create_staff(**overrides):
    defaults = {
        "staff_name": "Inbound Scanner",
        "staff_type": "Inbound",
        "check_code": 1234,
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_supplier(**overrides):
    defaults = {
        "supplier_name": "Scanner Supplier",
        "supplier_city": "New York",
        "supplier_address": "11 Vendor Rd",
        "supplier_contact": "555-2000",
        "supplier_manager": "Vendor Lead",
        "creator": "creator",
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return Supplier.objects.create(**defaults)


def create_customer(**overrides):
    defaults = {
        "customer_name": "Scanner Customer",
        "customer_city": "New York",
        "customer_address": "22 Client Rd",
        "customer_contact": "555-3000",
        "customer_manager": "Customer Lead",
        "creator": "creator",
        "openid": "scanner-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


class ScannerTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="scanner-openid", appid="scanner-appid")
        self.user = get_user_model().objects.create_user(username="scanner-api", password="password")
        self.warehouse = create_warehouse()
        self.storage_zone = create_zone(warehouse=self.warehouse, zone_code="STO", zone_name="Storage", usage=ZoneUsage.STORAGE)
        self.receiving_zone = create_zone(warehouse=self.warehouse, zone_code="RCV", zone_name="Receiving", usage=ZoneUsage.RECEIVING, sequence=20)
        self.shipping_zone = create_zone(warehouse=self.warehouse, zone_code="SHP", zone_name="Shipping", usage=ZoneUsage.SHIPPING, sequence=30)
        self.storage_type = create_location_type(openid=self.warehouse.openid, type_code="PALLET", type_name="Pallet Rack")
        self.receiving_type = create_location_type(openid=self.warehouse.openid, type_code="RCV", type_name="Receiving", picking_enabled=False)
        self.shipping_type = create_location_type(openid=self.warehouse.openid, type_code="SHIP", type_name="Shipping", putaway_enabled=False)
        self.location = create_location(
            warehouse=self.warehouse,
            zone=self.storage_zone,
            location_type=self.storage_type,
            location_code="STO-01",
            barcode="STO-01",
        )
        self.receiving_location = create_location(
            warehouse=self.warehouse,
            zone=self.receiving_zone,
            location_type=self.receiving_type,
            location_code="RCV-01",
            barcode="RCV-01",
        )
        self.shipping_location = create_location(
            warehouse=self.warehouse,
            zone=self.shipping_zone,
            location_type=self.shipping_type,
            location_code="SHP-01",
            barcode="SHP-01",
        )
        self.goods = create_goods(openid=self.warehouse.openid)
        self.inbound_operator = create_staff(openid=self.warehouse.openid, staff_name="Inbound Scanner", staff_type="Inbound", check_code=1234)
        self.outbound_operator = create_staff(openid=self.warehouse.openid, staff_name="Outbound Scanner", staff_type="Outbound", check_code=5678)
        self.supplier = create_supplier(openid=self.warehouse.openid)
        self.customer = create_customer(openid=self.warehouse.openid)

    def _auth_request(self, request, operator: Staff) -> None:
        request.META["HTTP_OPERATOR"] = str(operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def _build_inbound_purchase_order(self) -> None:
        self.purchase_order = create_purchase_order(
            openid=self.warehouse.openid,
            operator_name=self.inbound_operator.staff_name,
            warehouse=self.warehouse,
            supplier=self.supplier,
            po_number="PO-SCAN-001",
            expected_arrival_date=None,
            reference_code="",
            notes="",
            line_items=[
                PurchaseOrderLinePayload(
                    line_number=1,
                    goods=self.goods,
                    ordered_qty=Decimal("3.0000"),
                    unit_cost=Decimal("5.0000"),
                    stock_status=InventoryStatus.AVAILABLE,
                )
            ],
        )

    def _build_outbound_pick_task(self) -> PickTask:
        InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.location,
            goods=self.goods,
            stock_status=InventoryStatus.AVAILABLE,
            lot_number="",
            serial_number="",
            on_hand_qty=Decimal("4.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.0000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.sales_order = create_sales_order(
            openid=self.warehouse.openid,
            operator_name=self.outbound_operator.staff_name,
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.shipping_location,
            order_number="SO-SCAN-001",
            requested_ship_date=None,
            reference_code="",
            notes="",
            line_items=[
                SalesOrderLinePayload(
                    line_number=1,
                    goods=self.goods,
                    ordered_qty=Decimal("2.0000"),
                    unit_price=Decimal("10.0000"),
                    stock_status=InventoryStatus.AVAILABLE,
                )
            ],
        )
        allocation = allocate_sales_order(
            openid=self.warehouse.openid,
            operator_name=self.outbound_operator.staff_name,
            sales_order=self.sales_order,
            assigned_to=self.outbound_operator,
        )
        self.assertEqual(allocation.allocated_tasks, 1)
        return PickTask.objects.get(openid=self.warehouse.openid, is_delete=False)

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

    def test_handheld_session_lifecycle_api(self) -> None:
        create_view = HandheldDeviceSessionViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/scanner/device-sessions/",
            {
                "device_id": "DEVICE-01",
                "device_label": "Honeywell 01",
                "app_version": "2.1.0",
                "platform": "android",
                "metadata": {"battery": 90},
            },
            format="json",
        )
        self._auth_request(create_request, self.inbound_operator)
        create_response = create_view(create_request)
        self.assertEqual(create_response.status_code, 201)
        self.assertEqual(create_response.data["status"], HandheldDeviceSessionStatus.ACTIVE)

        heartbeat_view = HandheldDeviceSessionViewSet.as_view({"post": "heartbeat"})
        heartbeat_request = self.factory.post(
            f"/api/scanner/device-sessions/{create_response.data['id']}/heartbeat/",
            {"app_version": "2.1.1", "metadata": {"signal": "good"}},
            format="json",
        )
        self._auth_request(heartbeat_request, self.inbound_operator)
        heartbeat_response = heartbeat_view(heartbeat_request, pk=create_response.data["id"])
        self.assertEqual(heartbeat_response.status_code, 200)
        self.assertEqual(heartbeat_response.data["app_version"], "2.1.1")
        self.assertEqual(heartbeat_response.data["metadata"]["signal"], "good")

        end_view = HandheldDeviceSessionViewSet.as_view({"post": "end"})
        end_request = self.factory.post(
            f"/api/scanner/device-sessions/{create_response.data['id']}/end/",
            {"notes": "Shift complete"},
            format="json",
        )
        self._auth_request(end_request, self.inbound_operator)
        end_response = end_view(end_request, pk=create_response.data["id"])
        self.assertEqual(end_response.status_code, 200)
        self.assertEqual(end_response.data["status"], HandheldDeviceSessionStatus.ENDED)

    def test_handheld_telemetry_updates_session_aggregates(self) -> None:
        session = start_handheld_device_session(
            openid=self.warehouse.openid,
            operator=self.inbound_operator,
            payload=DeviceSessionPayload(device_id="DEVICE-TLM-01"),
        )
        view = HandheldTelemetrySampleViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/scanner/telemetry-samples/",
            {
                "session": session.id,
                "scan_count": 12,
                "queued_event_count": 4,
                "sync_count": 1,
                "replay_conflict_count": 2,
                "replay_failure_count": 1,
                "battery_level": 81,
                "network_type": "wifi",
                "signal_strength": -58,
                "latency_ms": 240,
                "storage_free_mb": "1024.5000",
                "metadata": {"firmware": "1.0.3"},
            },
            format="json",
        )
        self._auth_request(request, self.inbound_operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["network_type"], "wifi")
        self.assertEqual(HandheldTelemetrySample.objects.filter(openid=self.warehouse.openid).count(), 1)

        session.refresh_from_db()
        self.assertEqual(session.telemetry_sample_count, 1)
        self.assertEqual(session.total_scan_count, 12)
        self.assertEqual(session.total_sync_count, 1)
        self.assertEqual(session.total_conflict_count, 2)
        self.assertEqual(session.total_failure_count, 1)
        self.assertEqual(session.last_battery_level, 81)
        self.assertEqual(session.last_network_type, "wifi")

    def test_offline_replay_batch_applies_inbound_receive_and_is_idempotent(self) -> None:
        self._build_inbound_purchase_order()
        session = start_handheld_device_session(
            openid=self.warehouse.openid,
            operator=self.inbound_operator,
            payload=DeviceSessionPayload(device_id="DEVICE-IN-01"),
        )
        view = OfflineReplayBatchViewSet.as_view({"post": "create"})
        payload = {
            "session": session.id,
            "client_batch_id": "BATCH-IN-001",
            "events": [
                {
                    "sequence_number": 1,
                    "event_type": OfflineReplayEventType.INBOUND_RECEIVE,
                    "payload": {
                        "purchase_order_number": self.purchase_order.po_number,
                        "asn_number": "",
                        "receipt_number": "RCPT-SCAN-001",
                        "receipt_location_barcode": self.receiving_location.barcode,
                        "goods_barcode": self.goods.bar_code,
                        "lpn_barcode": "",
                        "attribute_scan": "",
                        "received_qty": "3.0000",
                        "stock_status": InventoryStatus.AVAILABLE,
                        "lot_number": "",
                        "serial_number": "",
                        "unit_cost": "5.0000",
                        "reference_code": "",
                        "notes": "offline receive",
                    },
                }
            ],
        }
        request = self.factory.post("/api/scanner/offline-replay-batches/", payload, format="json")
        self._auth_request(request, self.inbound_operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], OfflineReplayBatchStatus.COMPLETED)
        self.assertEqual(response.data["replayed_count"], 1)
        self.assertEqual(response.data["events"][0]["result_record_type"], "Receipt")
        self.assertEqual(Receipt.objects.filter(openid=self.warehouse.openid, receipt_number="RCPT-SCAN-001").count(), 1)
        self.assertTrue(PutawayTask.objects.filter(openid=self.warehouse.openid, receipt_line__receipt__receipt_number="RCPT-SCAN-001").exists())

        repeat_request = self.factory.post("/api/scanner/offline-replay-batches/", payload, format="json")
        self._auth_request(repeat_request, self.inbound_operator)
        repeat_response = view(repeat_request)
        self.assertEqual(repeat_response.status_code, 200)
        self.assertEqual(Receipt.objects.filter(openid=self.warehouse.openid, receipt_number="RCPT-SCAN-001").count(), 1)

        second_batch_request = self.factory.post(
            "/api/scanner/offline-replay-batches/",
            {
                **payload,
                "client_batch_id": "BATCH-IN-002",
            },
            format="json",
        )
        self._auth_request(second_batch_request, self.inbound_operator)
        second_batch_response = view(second_batch_request)
        self.assertEqual(second_batch_response.status_code, 201)
        self.assertEqual(second_batch_response.data["status"], OfflineReplayBatchStatus.COMPLETED)
        self.assertEqual(second_batch_response.data["events"][0]["status"], OfflineReplayEventStatus.SKIPPED)
        self.assertEqual(second_batch_response.data["events"][0]["conflict_rule"], "IDEMPOTENT_SKIP")

    def test_offline_replay_batch_applies_outbound_pick_and_ship(self) -> None:
        pick_task = self._build_outbound_pick_task()
        session = start_handheld_device_session(
            openid=self.warehouse.openid,
            operator=self.outbound_operator,
            payload=DeviceSessionPayload(device_id="DEVICE-OUT-01"),
        )
        view = OfflineReplayBatchViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/scanner/offline-replay-batches/",
            {
                "session": session.id,
                "client_batch_id": "BATCH-OUT-001",
                "events": [
                    {
                        "sequence_number": 1,
                        "event_type": OfflineReplayEventType.OUTBOUND_PICK,
                        "payload": {
                            "task_number": pick_task.task_number,
                            "from_location_barcode": self.location.barcode,
                            "goods_barcode": self.goods.bar_code,
                            "to_location_barcode": self.shipping_location.barcode,
                            "lpn_barcode": "",
                        },
                    },
                    {
                        "sequence_number": 2,
                        "event_type": OfflineReplayEventType.OUTBOUND_SHIP,
                        "payload": {
                            "sales_order_number": self.sales_order.order_number,
                            "shipment_number": "SHP-SCAN-001",
                            "staging_location_barcode": self.shipping_location.barcode,
                            "goods_barcode": self.goods.bar_code,
                            "dock_location_barcode": self.shipping_location.barcode,
                            "lpn_barcode": "",
                            "attribute_scan": "",
                            "shipped_qty": "2.0000",
                            "stock_status": InventoryStatus.AVAILABLE,
                            "lot_number": "",
                            "serial_number": "",
                            "reference_code": "",
                            "notes": "offline ship",
                            "trailer_reference": "TR-01",
                        },
                    },
                ],
            },
            format="json",
        )
        self._auth_request(request, self.outbound_operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], OfflineReplayBatchStatus.COMPLETED)
        pick_task.refresh_from_db()
        self.assertEqual(pick_task.status, PickTaskStatus.COMPLETED)
        self.assertTrue(Shipment.objects.filter(openid=self.warehouse.openid, shipment_number="SHP-SCAN-001").exists())
        active_session = HandheldDeviceSession.objects.get(pk=session.id)
        self.assertIsNotNone(active_session.last_sync_at)
        self.assertEqual(active_session.total_replayed_count, 2)

    def test_offline_replay_batch_marks_state_mismatch_as_conflict(self) -> None:
        self._build_inbound_purchase_order()
        session = start_handheld_device_session(
            openid=self.warehouse.openid,
            operator=self.inbound_operator,
            payload=DeviceSessionPayload(device_id="DEVICE-IN-02"),
        )
        view = OfflineReplayBatchViewSet.as_view({"post": "create"})
        initial_request = self.factory.post(
            "/api/scanner/offline-replay-batches/",
            {
                "session": session.id,
                "client_batch_id": "BATCH-CONFLICT-001",
                "events": [
                    {
                        "sequence_number": 1,
                        "event_type": OfflineReplayEventType.INBOUND_RECEIVE,
                        "payload": {
                            "purchase_order_number": self.purchase_order.po_number,
                            "asn_number": "",
                            "receipt_number": "RCPT-CONFLICT-001",
                            "receipt_location_barcode": self.receiving_location.barcode,
                            "goods_barcode": self.goods.bar_code,
                            "lpn_barcode": "",
                            "attribute_scan": "",
                            "received_qty": "3.0000",
                            "stock_status": InventoryStatus.AVAILABLE,
                            "lot_number": "",
                            "serial_number": "",
                            "unit_cost": "5.0000",
                            "reference_code": "",
                            "notes": "initial receive",
                        },
                    }
                ],
            },
            format="json",
        )
        self._auth_request(initial_request, self.inbound_operator)
        self.assertEqual(view(initial_request).status_code, 201)

        conflict_request = self.factory.post(
            "/api/scanner/offline-replay-batches/",
            {
                "session": session.id,
                "client_batch_id": "BATCH-CONFLICT-002",
                "events": [
                    {
                        "sequence_number": 1,
                        "event_type": OfflineReplayEventType.INBOUND_RECEIVE,
                        "payload": {
                            "purchase_order_number": self.purchase_order.po_number,
                            "asn_number": "",
                            "receipt_number": "RCPT-CONFLICT-001",
                            "receipt_location_barcode": self.receiving_location.barcode,
                            "goods_barcode": self.goods.bar_code,
                            "lpn_barcode": "",
                            "attribute_scan": "",
                            "received_qty": "2.0000",
                            "stock_status": InventoryStatus.AVAILABLE,
                            "lot_number": "",
                            "serial_number": "",
                            "unit_cost": "5.0000",
                            "reference_code": "",
                            "notes": "conflicting receive",
                        },
                    }
                ],
            },
            format="json",
        )
        self._auth_request(conflict_request, self.inbound_operator)
        conflict_response = view(conflict_request)
        self.assertEqual(conflict_response.status_code, 201)
        self.assertEqual(conflict_response.data["status"], OfflineReplayBatchStatus.CONFLICTED)
        self.assertEqual(conflict_response.data["conflict_count"], 1)
        self.assertEqual(conflict_response.data["events"][0]["status"], OfflineReplayEventStatus.CONFLICT)
        self.assertEqual(conflict_response.data["events"][0]["conflict_type"], "STATE_MISMATCH")
