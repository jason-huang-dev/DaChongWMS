from __future__ import annotations

from datetime import date
from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryStatus
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from operations.counting.models import CountApproval, CountApprovalStatus, CycleCount, CycleCountLine, CycleCountLineStatus, CycleCountStatus
from operations.inbound.models import PurchaseOrder, PurchaseOrderLine, PurchaseOrderStatus, PutawayTask, PutawayTaskStatus, Receipt, ReceiptLine
from operations.outbound.models import SalesOrder, SalesOrderLine, SalesOrderStatus, Shipment, ShipmentLine
from operations.outbound.services import ShipmentLinePayload, create_shipment
from operations.returns.models import ReturnLine, ReturnOrder, ReturnOrderStatus
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import (
    BillingChargeEvent,
    BillingChargeStatus,
    BillingChargeType,
    CreditNoteStatus,
    ExternalRemittanceBatchStatus,
    FinanceApprovalStatus,
    Invoice,
    InvoiceDisputeStatus,
    InvoiceFinanceApproval,
    InvoiceRemittanceSource,
    InvoiceSettlementStatus,
    InvoiceStatus,
    OperationalReportType,
)
from .views import (
    BillingChargeEventViewSet,
    BillingRateContractViewSet,
    CreditNoteViewSet,
    ExternalRemittanceBatchViewSet,
    FinanceExportViewSet,
    InvoiceDisputeViewSet,
    InvoiceRemittanceViewSet,
    InvoiceSettlementViewSet,
    InvoiceViewSet,
    OperationalReportExportViewSet,
    StorageAccrualRunViewSet,
    WarehouseKpiSnapshotViewSet,
)


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Reporting Owner",
        "vip": 1,
        "openid": "reporting-openid",
        "appid": "reporting-appid",
        "t_code": "reporting-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Reporting Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "reporting-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Reporting Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "700 Metrics Blvd",
        "warehouse_contact": "555-7700",
        "warehouse_manager": "Metrics Lead",
        "creator": "creator",
        "openid": "reporting-openid",
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
        "allow_mixed_sku": True,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "reporting-openid",
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


def create_customer(**overrides: Any) -> Customer:
    defaults = {
        "customer_name": "Reporting Customer",
        "customer_city": "New York",
        "customer_address": "88 Client Rd",
        "customer_contact": "555-8800",
        "customer_manager": "Client Lead",
        "creator": "creator",
        "openid": "reporting-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


def create_supplier(**overrides: Any) -> Supplier:
    defaults = {
        "supplier_name": "Reporting Supplier",
        "supplier_city": "New York",
        "supplier_address": "77 Vendor Rd",
        "supplier_contact": "555-9901",
        "supplier_manager": "Vendor Lead",
        "creator": "creator",
        "openid": "reporting-openid",
    }
    defaults.update(overrides)
    return Supplier.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-RPT-001",
        "goods_desc": "Reporting Widget",
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
        "bar_code": "BAR-RPT-001",
        "openid": "reporting-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class ReportingApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="reporting-openid", appid="reporting-appid")
        self.user = get_user_model().objects.create_user(username="reporting-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.finance_operator = create_staff(staff_name="Finance Analyst", staff_type="Finance", check_code=3333)
        self.viewer = create_staff(staff_name="Viewer", staff_type="Viewer", check_code=2222)
        self.warehouse = create_warehouse()
        self.storage_zone = create_zone(warehouse=self.warehouse, zone_code="STO", zone_name="Storage", usage=ZoneUsage.STORAGE)
        self.receiving_zone = create_zone(warehouse=self.warehouse, zone_code="RCV", zone_name="Receiving", usage=ZoneUsage.RECEIVING, sequence=20)
        self.shipping_zone = create_zone(warehouse=self.warehouse, zone_code="SHP", zone_name="Shipping", usage=ZoneUsage.SHIPPING, sequence=30)
        self.returns_zone = create_zone(warehouse=self.warehouse, zone_code="RET", zone_name="Returns", usage=ZoneUsage.RETURNS, sequence=40)
        self.storage_type = create_location_type(openid=self.warehouse.openid, type_code="PALLET", type_name="Pallet Rack")
        self.receiving_type = create_location_type(openid=self.warehouse.openid, type_code="RECV", type_name="Receiving Stage", picking_enabled=False)
        self.shipping_type = create_location_type(openid=self.warehouse.openid, type_code="SHIP", type_name="Shipping Stage", putaway_enabled=False)
        self.returns_type = create_location_type(openid=self.warehouse.openid, type_code="RET", type_name="Returns Stage", picking_enabled=False)
        self.storage_location = create_location(warehouse=self.warehouse, zone=self.storage_zone, location_type=self.storage_type, location_code="STO-01")
        self.receiving_location = create_location(warehouse=self.warehouse, zone=self.receiving_zone, location_type=self.receiving_type, location_code="RCV-01", barcode="RCV-01")
        self.shipping_location = create_location(warehouse=self.warehouse, zone=self.shipping_zone, location_type=self.shipping_type, location_code="SHP-01", barcode="SHP-01")
        self.returns_location = create_location(warehouse=self.warehouse, zone=self.returns_zone, location_type=self.returns_type, location_code="RET-01", barcode="RET-01")
        self.customer = create_customer(openid=self.warehouse.openid)
        self.supplier = create_supplier(openid=self.warehouse.openid)
        self.goods = create_goods(openid=self.warehouse.openid)
        self.balance = InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.storage_location,
            goods=self.goods,
            stock_status=InventoryStatus.AVAILABLE,
            lot_number="",
            serial_number="",
            on_hand_qty=Decimal("10.0000"),
            allocated_qty=Decimal("2.0000"),
            hold_qty=Decimal("1.0000"),
            unit_cost=Decimal("5.0000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.purchase_order = PurchaseOrder.objects.create(
            warehouse=self.warehouse,
            supplier=self.supplier,
            po_number="PO-RPT-001",
            status=PurchaseOrderStatus.OPEN,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.purchase_order_line = PurchaseOrderLine.objects.create(
            purchase_order=self.purchase_order,
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("5.0000"),
            received_qty=Decimal("3.0000"),
            unit_cost=Decimal("5.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.receipt = Receipt.objects.create(
            purchase_order=self.purchase_order,
            warehouse=self.warehouse,
            receipt_location=self.receiving_location,
            receipt_number="RCPT-RPT-001",
            received_by="creator",
            creator="creator",
            openid=self.warehouse.openid,
        )
        ReceiptLine.objects.create(
            receipt=self.receipt,
            purchase_order_line=self.purchase_order_line,
            goods=self.goods,
            receipt_location=self.receiving_location,
            received_qty=Decimal("3.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            unit_cost=Decimal("5.0000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        PutawayTask.objects.create(
            receipt_line=self.receipt.lines.get(),
            warehouse=self.warehouse,
            goods=self.goods,
            task_number="PT-RPT-001",
            from_location=self.receiving_location,
            to_location=self.storage_location,
            quantity=Decimal("3.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            status=PutawayTaskStatus.OPEN,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.shipping_location,
            order_number="SO-RPT-001",
            status=SalesOrderStatus.ALLOCATED,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.sales_order_line = SalesOrderLine.objects.create(
            sales_order=self.sales_order,
            line_number=1,
            goods=self.goods,
            ordered_qty=Decimal("2.0000"),
            allocated_qty=Decimal("2.0000"),
            picked_qty=Decimal("0.0000"),
            shipped_qty=Decimal("0.0000"),
            unit_price=Decimal("15.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.shipment = Shipment.objects.create(
            sales_order=self.sales_order,
            warehouse=self.warehouse,
            staging_location=self.shipping_location,
            shipment_number="SHP-RPT-001",
            shipped_by="creator",
            creator="creator",
            openid=self.warehouse.openid,
        )
        ShipmentLine.objects.create(
            shipment=self.shipment,
            sales_order_line=self.sales_order_line,
            goods=self.goods,
            from_location=self.shipping_location,
            shipped_qty=Decimal("1.0000"),
            stock_status=InventoryStatus.AVAILABLE,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.return_order = ReturnOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            return_number="RMA-RPT-001",
            status=ReturnOrderStatus.PARTIAL_RECEIVED,
            creator="creator",
            openid=self.warehouse.openid,
        )
        ReturnLine.objects.create(
            return_order=self.return_order,
            line_number=1,
            goods=self.goods,
            expected_qty=Decimal("1.0000"),
            received_qty=Decimal("1.0000"),
            disposed_qty=Decimal("0.0000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.count = CycleCount.objects.create(
            warehouse=self.warehouse,
            count_number="CC-RPT-001",
            status=CycleCountStatus.PENDING_APPROVAL,
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.count_line = CycleCountLine.objects.create(
            cycle_count=self.count,
            line_number=1,
            inventory_balance=self.balance,
            location=self.storage_location,
            goods=self.goods,
            stock_status=InventoryStatus.AVAILABLE,
            system_qty=Decimal("10.0000"),
            counted_qty=Decimal("9.0000"),
            variance_qty=Decimal("-1.0000"),
            status=CycleCountLineStatus.PENDING_APPROVAL,
            creator="creator",
            openid=self.warehouse.openid,
        )
        CountApproval.objects.create(
            cycle_count_line=self.count_line,
            status=CountApprovalStatus.PENDING,
            requested_by="creator",
            creator="creator",
            openid=self.warehouse.openid,
        )

    def _auth_request(self, request, operator: Staff) -> None:
        request.META["HTTP_OPERATOR"] = str(operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def _create_finance_ready_invoice(self, invoice_number: str = "INV-SET-001") -> Invoice:
        charge_event = BillingChargeEvent.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            event_date=date.today(),
            quantity=Decimal("1.0000"),
            unit_rate=Decimal("10.0000"),
            amount=Decimal("10.0000"),
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="operations.outbound",
            source_record_type="Shipment",
            source_record_id=None,
            reference_code=invoice_number,
            notes="Settlement workflow seed",
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        invoice_view = InvoiceViewSet.as_view({"post": "create"})
        invoice_request = self.factory.post(
            "/api/reporting/invoices/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "invoice_number": invoice_number,
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(invoice_request, self.operator)
        invoice_response = invoice_view(invoice_request)
        self.assertEqual(invoice_response.status_code, 201)
        charge_event.refresh_from_db()
        self.assertEqual(charge_event.status, BillingChargeStatus.INVOICED)

        invoice = Invoice.objects.get(pk=invoice_response.data["id"])
        finalize_view = InvoiceViewSet.as_view({"post": "finalize"})
        finalize_request = self.factory.post(
            f"/api/reporting/invoices/{invoice.id}/finalize/",
            {"notes": "Ready for settlement"},
            format="json",
        )
        self._auth_request(finalize_request, self.operator)
        self.assertEqual(finalize_view(finalize_request, pk=invoice.id).status_code, 200)

        submit_view = InvoiceViewSet.as_view({"post": "submit_finance_review"})
        submit_request = self.factory.post(
            f"/api/reporting/invoices/{invoice.id}/submit-finance-review/",
            {"notes": "Finance review"},
            format="json",
        )
        self._auth_request(submit_request, self.finance_operator)
        self.assertEqual(submit_view(submit_request, pk=invoice.id).status_code, 200)

        approve_view = InvoiceViewSet.as_view({"post": "approve_finance_review"})
        approve_request = self.factory.post(
            f"/api/reporting/invoices/{invoice.id}/approve-finance-review/",
            {"notes": "Approved"},
            format="json",
        )
        self._auth_request(approve_request, self.finance_operator)
        self.assertEqual(approve_view(approve_request, pk=invoice.id).status_code, 200)
        invoice.refresh_from_db()
        return invoice

    def _create_approved_settlement(self, invoice_number: str = "INV-SET-APPROVED") -> Invoice:
        invoice = self._create_finance_ready_invoice(invoice_number)
        settlement_view = InvoiceSettlementViewSet.as_view({"post": "create"})
        settlement_request = self.factory.post(
            "/api/reporting/invoice-settlements/",
            {
                "invoice": invoice.pk,
                "requested_amount": "10.0000",
                "settlement_reference": f"SET-{invoice_number}",
            },
            format="json",
        )
        self._auth_request(settlement_request, self.finance_operator)
        settlement_response = settlement_view(settlement_request)
        self.assertEqual(settlement_response.status_code, 201)

        approve_view = InvoiceSettlementViewSet.as_view({"post": "approve"})
        approve_request = self.factory.post(
            f"/api/reporting/invoice-settlements/{settlement_response.data['id']}/approve/",
            {"approved_amount": "10.0000"},
            format="json",
        )
        self._auth_request(approve_request, self.finance_operator)
        self.assertEqual(approve_view(approve_request, pk=settlement_response.data["id"]).status_code, 200)
        invoice.refresh_from_db()
        return invoice

    def test_kpi_snapshot_summarizes_current_operational_state(self) -> None:
        view = WarehouseKpiSnapshotViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/reporting/kpi-snapshots/",
            {"warehouse": self.warehouse.pk, "snapshot_date": date.today().isoformat()},
            format="json",
        )
        self._auth_request(request, self.operator)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["on_hand_qty"], "10.0000")
        self.assertEqual(response.data["available_qty"], "7.0000")
        self.assertEqual(response.data["open_purchase_orders"], 1)
        self.assertEqual(response.data["open_sales_orders"], 1)
        self.assertEqual(response.data["open_putaway_tasks"], 1)
        self.assertEqual(response.data["pending_count_approvals"], 1)
        self.assertEqual(response.data["pending_return_orders"], 1)

    def test_inventory_aging_export_downloads_csv(self) -> None:
        export_view = OperationalReportExportViewSet.as_view({"post": "create"})
        export_request = self.factory.post(
            "/api/reporting/report-exports/",
            {"warehouse": self.warehouse.pk, "report_type": OperationalReportType.INVENTORY_AGING},
            format="json",
        )
        self._auth_request(export_request, self.operator)
        export_response = export_view(export_request)
        self.assertEqual(export_response.status_code, 201)
        self.assertEqual(export_response.data["row_count"], 1)

        download_view = OperationalReportExportViewSet.as_view({"get": "download"})
        download_request = self.factory.get(f"/api/reporting/report-exports/{export_response.data['id']}/download/")
        self._auth_request(download_request, self.operator)
        download_response = download_view(download_request, pk=export_response.data["id"])
        self.assertEqual(download_response.status_code, 200)
        self.assertEqual(download_response["Content-Type"], "text/csv")
        self.assertIn("SKU-RPT-001", download_response.content.decode("utf-8"))

    def test_shipment_creation_records_zero_rated_billing_event(self) -> None:
        self.balance.allocated_qty = Decimal("0.0000")
        self.balance.hold_qty = Decimal("0.0000")
        self.balance.save(update_fields=["allocated_qty", "hold_qty", "update_time"])
        self.sales_order_line.allocated_qty = Decimal("0.0000")
        self.sales_order_line.picked_qty = Decimal("1.0000")
        self.sales_order_line.save(update_fields=["allocated_qty", "picked_qty", "update_time"])
        InventoryBalance.objects.create(
            warehouse=self.warehouse,
            location=self.shipping_location,
            goods=self.goods,
            stock_status=InventoryStatus.AVAILABLE,
            lot_number="",
            serial_number="",
            on_hand_qty=Decimal("1.0000"),
            allocated_qty=Decimal("0.0000"),
            hold_qty=Decimal("0.0000"),
            unit_cost=Decimal("5.0000"),
            creator="creator",
            openid=self.warehouse.openid,
        )
        shipment = create_shipment(
            openid=self.warehouse.openid,
            operator_name=self.operator.staff_name,
            sales_order=self.sales_order,
            warehouse=self.warehouse,
            staging_location=self.shipping_location,
            shipment_number="SHP-RPT-002",
            reference_code="",
            notes="",
            line_items=[
                ShipmentLinePayload(
                    sales_order_line=self.sales_order_line,
                    shipped_qty=Decimal("1.0000"),
                    stock_status=InventoryStatus.AVAILABLE,
                    lot_number="",
                    serial_number="",
                    from_location=self.shipping_location,
                )
            ],
        )
        charge_event = BillingChargeEvent.objects.get(
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            source_record_type="Shipment",
            source_record_id=shipment.id,
        )
        self.assertEqual(charge_event.amount, Decimal("0.0000"))
        self.assertEqual(charge_event.status, BillingChargeStatus.OPEN)
        self.assertEqual(charge_event.customer_id, self.customer.id)

    def test_rate_contract_and_invoice_api_rate_open_events(self) -> None:
        BillingChargeEvent.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            event_date=date.today(),
            quantity=Decimal("1.0000"),
            unit_rate=Decimal("0.0000"),
            amount=Decimal("0.0000"),
            currency="USD",
            status=BillingChargeStatus.OPEN,
            source_module="operations.outbound",
            source_record_type="Shipment",
            source_record_id=self.shipment.id,
            reference_code=self.shipment.shipment_number,
            notes="Operational shipment event captured for 3PL billing review",
            creator="creator",
            openid=self.warehouse.openid,
        )
        contract_view = BillingRateContractViewSet.as_view({"post": "create"})
        contract_request = self.factory.post(
            "/api/reporting/rate-contracts/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "contract_name": "Shipment Handling Contract",
                "charge_type": BillingChargeType.SHIPMENT_HANDLING,
                "unit_rate": "2.5000",
                "minimum_charge": "0.0000",
                "effective_from": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(contract_request, self.operator)
        contract_response = contract_view(contract_request)
        self.assertEqual(contract_response.status_code, 201)

        invoice_view = InvoiceViewSet.as_view({"post": "create"})
        invoice_request = self.factory.post(
            "/api/reporting/invoices/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "invoice_number": "INV-001",
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(invoice_request, self.operator)
        invoice_response = invoice_view(invoice_request)
        self.assertEqual(invoice_response.status_code, 201)
        charge_event = BillingChargeEvent.objects.get(
            charge_type=BillingChargeType.SHIPMENT_HANDLING,
            source_record_type="Shipment",
            source_record_id=self.shipment.id,
        )
        self.assertEqual(charge_event.status, BillingChargeStatus.INVOICED)
        self.assertEqual(charge_event.amount, Decimal("2.5000"))
        self.assertEqual(invoice_response.data["total_amount"], "2.5000")

        finalize_view = InvoiceViewSet.as_view({"post": "finalize"})
        finalize_request = self.factory.post(
            f"/api/reporting/invoices/{invoice_response.data['id']}/finalize/",
            {"notes": "Approved"},
            format="json",
        )
        self._auth_request(finalize_request, self.operator)
        finalize_response = finalize_view(finalize_request, pk=invoice_response.data["id"])
        self.assertEqual(finalize_response.status_code, 200)
        self.assertEqual(finalize_response.data["status"], InvoiceStatus.FINALIZED)

    def test_viewer_cannot_create_manual_billing_charge_event(self) -> None:
        view = BillingChargeEventViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/reporting/billing-charge-events/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "charge_type": BillingChargeType.EXTRA_SCAN,
                "event_date": date.today().isoformat(),
                "quantity": "1.0000",
                "unit_rate": "2.5000",
                "status": BillingChargeStatus.OPEN,
            },
            format="json",
        )
        self._auth_request(request, self.viewer)
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_storage_accrual_create_and_finance_approval_export_flow(self) -> None:
        contract_view = BillingRateContractViewSet.as_view({"post": "create"})
        contract_request = self.factory.post(
            "/api/reporting/rate-contracts/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "contract_name": "Storage Contract",
                "charge_type": BillingChargeType.STORAGE_DAILY,
                "unit_rate": "1.0000",
                "minimum_charge": "0.0000",
                "effective_from": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(contract_request, self.operator)
        self.assertEqual(contract_view(contract_request).status_code, 201)

        accrual_view = StorageAccrualRunViewSet.as_view({"post": "create"})
        accrual_request = self.factory.post(
            "/api/reporting/storage-accrual-runs/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "accrual_date": date.today().isoformat(),
                "notes": "Daily storage accrual",
            },
            format="json",
        )
        self._auth_request(accrual_request, self.operator)
        accrual_response = accrual_view(accrual_request)
        self.assertEqual(accrual_response.status_code, 201)
        storage_charge = BillingChargeEvent.objects.get(charge_type=BillingChargeType.STORAGE_DAILY)
        self.assertEqual(storage_charge.quantity, Decimal("10.0000"))

        invoice_view = InvoiceViewSet.as_view({"post": "create"})
        invoice_request = self.factory.post(
            "/api/reporting/invoices/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "invoice_number": "INV-FIN-100",
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(invoice_request, self.operator)
        invoice_response = invoice_view(invoice_request)
        self.assertEqual(invoice_response.status_code, 201)

        finalize_view = InvoiceViewSet.as_view({"post": "finalize"})
        finalize_request = self.factory.post(
            f"/api/reporting/invoices/{invoice_response.data['id']}/finalize/",
            {"notes": "Ready for finance"},
            format="json",
        )
        self._auth_request(finalize_request, self.operator)
        self.assertEqual(finalize_view(finalize_request, pk=invoice_response.data["id"]).status_code, 200)

        submit_view = InvoiceViewSet.as_view({"post": "submit_finance_review"})
        submit_request = self.factory.post(
            f"/api/reporting/invoices/{invoice_response.data['id']}/submit-finance-review/",
            {"notes": "Please review"},
            format="json",
        )
        self._auth_request(submit_request, self.finance_operator)
        submit_response = submit_view(submit_request, pk=invoice_response.data["id"])
        self.assertEqual(submit_response.status_code, 200)
        self.assertEqual(submit_response.data["finance_approval"]["status"], FinanceApprovalStatus.PENDING)

        approve_view = InvoiceViewSet.as_view({"post": "approve_finance_review"})
        approve_request = self.factory.post(
            f"/api/reporting/invoices/{invoice_response.data['id']}/approve-finance-review/",
            {"notes": "Approved"},
            format="json",
        )
        self._auth_request(approve_request, self.finance_operator)
        approve_response = approve_view(approve_request, pk=invoice_response.data["id"])
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.data["finance_approval"]["status"], FinanceApprovalStatus.APPROVED)

        finance_export_view = FinanceExportViewSet.as_view({"post": "create"})
        finance_export_request = self.factory.post(
            "/api/reporting/finance-exports/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(finance_export_request, self.finance_operator)
        finance_export_response = finance_export_view(finance_export_request)
        self.assertEqual(finance_export_response.status_code, 201)
        self.assertEqual(finance_export_response.data["row_count"], 1)

    def test_invoice_settlement_remittance_and_dispute_workflow(self) -> None:
        invoice = self._create_finance_ready_invoice("INV-SET-100")

        settlement_view = InvoiceSettlementViewSet.as_view({"post": "create"})
        settlement_request = self.factory.post(
            "/api/reporting/invoice-settlements/",
            {
                "invoice": invoice.pk,
                "requested_amount": "10.0000",
                "settlement_reference": "SET-100",
                "notes": "Submit settlement",
            },
            format="json",
        )
        self._auth_request(settlement_request, self.finance_operator)
        settlement_response = settlement_view(settlement_request)
        self.assertEqual(settlement_response.status_code, 201)
        self.assertEqual(settlement_response.data["status"], InvoiceSettlementStatus.PENDING_APPROVAL)

        approve_view = InvoiceSettlementViewSet.as_view({"post": "approve"})
        approve_request = self.factory.post(
            f"/api/reporting/invoice-settlements/{settlement_response.data['id']}/approve/",
            {"approved_amount": "10.0000", "notes": "Approve settlement"},
            format="json",
        )
        self._auth_request(approve_request, self.finance_operator)
        approve_response = approve_view(approve_request, pk=settlement_response.data["id"])
        self.assertEqual(approve_response.status_code, 200)
        self.assertEqual(approve_response.data["status"], InvoiceSettlementStatus.APPROVED)

        remittance_view = InvoiceRemittanceViewSet.as_view({"post": "create"})
        remittance_request = self.factory.post(
            "/api/reporting/invoice-remittances/",
            {
                "settlement": settlement_response.data["id"],
                "amount": "6.0000",
                "remittance_reference": "REM-100",
                "notes": "Partial payment",
            },
            format="json",
        )
        self._auth_request(remittance_request, self.finance_operator)
        remittance_response = remittance_view(remittance_request)
        self.assertEqual(remittance_response.status_code, 201)

        invoice.refresh_from_db()
        self.assertEqual(invoice.settlement.status, InvoiceSettlementStatus.PARTIALLY_REMITTED)
        self.assertEqual(invoice.settlement.remitted_amount, Decimal("6.0000"))

        dispute_view = InvoiceDisputeViewSet.as_view({"post": "create"})
        dispute_request = self.factory.post(
            "/api/reporting/invoice-disputes/",
            {
                "invoice": invoice.pk,
                "reason_code": "RATE",
                "disputed_amount": "2.0000",
                "reference_code": "DSP-100",
                "notes": "Rate mismatch",
            },
            format="json",
        )
        self._auth_request(dispute_request, self.finance_operator)
        dispute_response = dispute_view(dispute_request)
        self.assertEqual(dispute_response.status_code, 201)
        self.assertEqual(dispute_response.data["status"], InvoiceDisputeStatus.OPEN)

        review_dispute_view = InvoiceDisputeViewSet.as_view({"post": "review"})
        review_dispute_request = self.factory.post(
            f"/api/reporting/invoice-disputes/{dispute_response.data['id']}/review/",
            {"notes": "Review started"},
            format="json",
        )
        self._auth_request(review_dispute_request, self.finance_operator)
        review_dispute_response = review_dispute_view(review_dispute_request, pk=dispute_response.data["id"])
        self.assertEqual(review_dispute_response.status_code, 200)
        self.assertEqual(review_dispute_response.data["status"], InvoiceDisputeStatus.UNDER_REVIEW)

        resolve_dispute_view = InvoiceDisputeViewSet.as_view({"post": "resolve"})
        resolve_dispute_request = self.factory.post(
            f"/api/reporting/invoice-disputes/{dispute_response.data['id']}/resolve/",
            {"approved_credit_amount": "2.0000", "notes": "Credit approved"},
            format="json",
        )
        self._auth_request(resolve_dispute_request, self.finance_operator)
        resolve_dispute_response = resolve_dispute_view(resolve_dispute_request, pk=dispute_response.data["id"])
        self.assertEqual(resolve_dispute_response.status_code, 200)
        self.assertEqual(resolve_dispute_response.data["status"], InvoiceDisputeStatus.RESOLVED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.settlement.approved_amount, Decimal("8.0000"))

        final_remittance_request = self.factory.post(
            "/api/reporting/invoice-remittances/",
            {
                "settlement": invoice.settlement.id,
                "amount": "2.0000",
                "remittance_reference": "REM-101",
                "notes": "Final payment after dispute",
            },
            format="json",
        )
        self._auth_request(final_remittance_request, self.finance_operator)
        final_remittance_response = remittance_view(final_remittance_request)
        self.assertEqual(final_remittance_response.status_code, 201)

        invoice.refresh_from_db()
        self.assertEqual(invoice.settlement.status, InvoiceSettlementStatus.REMITTED)
        self.assertEqual(invoice.settlement.remitted_amount, Decimal("8.0000"))

    def test_finance_export_includes_settlement_and_dispute_columns(self) -> None:
        invoice = self._create_approved_settlement("INV-SET-200")

        finance_export_view = FinanceExportViewSet.as_view({"post": "create"})
        finance_export_request = self.factory.post(
            "/api/reporting/finance-exports/",
            {
                "warehouse": self.warehouse.pk,
                "customer": self.customer.pk,
                "period_start": date.today().isoformat(),
                "period_end": date.today().isoformat(),
            },
            format="json",
        )
        self._auth_request(finance_export_request, self.finance_operator)
        finance_export_response = finance_export_view(finance_export_request)
        self.assertEqual(finance_export_response.status_code, 201)
        self.assertIn("settlement_status", finance_export_response.data["content"])
        self.assertIn("approved_settlement_amount", finance_export_response.data["content"])
        self.assertIn("external_remitted_amount", finance_export_response.data["content"])
        self.assertIn("credit_note_total", finance_export_response.data["content"])
        self.assertIn("outstanding_amount", finance_export_response.data["content"])

    def test_credit_note_issue_and_apply_for_resolved_dispute(self) -> None:
        invoice = self._create_approved_settlement("INV-CN-100")

        dispute_view = InvoiceDisputeViewSet.as_view({"post": "create"})
        dispute_request = self.factory.post(
            "/api/reporting/invoice-disputes/",
            {
                "invoice": invoice.pk,
                "reason_code": "RATE",
                "disputed_amount": "2.0000",
                "reference_code": "DSP-CN-100",
                "notes": "Rate dispute",
            },
            format="json",
        )
        self._auth_request(dispute_request, self.finance_operator)
        dispute_response = dispute_view(dispute_request)
        self.assertEqual(dispute_response.status_code, 201)

        review_view = InvoiceDisputeViewSet.as_view({"post": "review"})
        review_request = self.factory.post(
            f"/api/reporting/invoice-disputes/{dispute_response.data['id']}/review/",
            {"notes": "Reviewed"},
            format="json",
        )
        self._auth_request(review_request, self.finance_operator)
        self.assertEqual(review_view(review_request, pk=dispute_response.data["id"]).status_code, 200)

        resolve_view = InvoiceDisputeViewSet.as_view({"post": "resolve"})
        resolve_request = self.factory.post(
            f"/api/reporting/invoice-disputes/{dispute_response.data['id']}/resolve/",
            {"approved_credit_amount": "2.0000", "notes": "Approved"},
            format="json",
        )
        self._auth_request(resolve_request, self.finance_operator)
        self.assertEqual(resolve_view(resolve_request, pk=dispute_response.data["id"]).status_code, 200)

        credit_note_view = CreditNoteViewSet.as_view({"post": "create"})
        credit_note_request = self.factory.post(
            "/api/reporting/credit-notes/",
            {
                "invoice": invoice.pk,
                "dispute": dispute_response.data["id"],
                "credit_note_number": "CN-100",
                "reference_code": "CR-100",
                "notes": "Issue credit note",
            },
            format="json",
        )
        self._auth_request(credit_note_request, self.finance_operator)
        credit_note_response = credit_note_view(credit_note_request)
        self.assertEqual(credit_note_response.status_code, 201)
        self.assertEqual(credit_note_response.data["status"], CreditNoteStatus.ISSUED)

        invoice.refresh_from_db()
        self.assertEqual(invoice.settlement.approved_amount, Decimal("8.0000"))

        apply_view = CreditNoteViewSet.as_view({"post": "apply"})
        apply_request = self.factory.post(
            f"/api/reporting/credit-notes/{credit_note_response.data['id']}/apply/",
            {"notes": "Applied to customer account"},
            format="json",
        )
        self._auth_request(apply_request, self.finance_operator)
        apply_response = apply_view(apply_request, pk=credit_note_response.data["id"])
        self.assertEqual(apply_response.status_code, 200)
        self.assertEqual(apply_response.data["status"], CreditNoteStatus.APPLIED)

    def test_external_remittance_batch_ingests_records_and_conflicts(self) -> None:
        invoice = self._create_approved_settlement("INV-EXT-100")
        batch_view = ExternalRemittanceBatchViewSet.as_view({"post": "create"})

        applied_request = self.factory.post(
            "/api/reporting/external-remittance-batches/",
            {
                "source_system": "erp",
                "external_batch_id": "ERP-BATCH-001",
                "items": [
                    {
                        "external_reference": "ERP-PMT-001",
                        "invoice_number": invoice.invoice_number,
                        "amount": "6.0000",
                        "currency": "USD",
                        "notes": "ERP remittance",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(applied_request, self.finance_operator)
        applied_response = batch_view(applied_request)
        self.assertEqual(applied_response.status_code, 201)
        self.assertEqual(applied_response.data["status"], ExternalRemittanceBatchStatus.COMPLETED)
        self.assertEqual(applied_response.data["applied_count"], 1)
        self.assertEqual(applied_response.data["items"][0]["status"], "APPLIED")

        invoice.refresh_from_db()
        self.assertEqual(invoice.settlement.remitted_amount, Decimal("6.0000"))
        self.assertEqual(invoice.settlement.remittances.get().source, InvoiceRemittanceSource.EXTERNAL)

        conflict_request = self.factory.post(
            "/api/reporting/external-remittance-batches/",
            {
                "source_system": "erp",
                "external_batch_id": "ERP-BATCH-002",
                "items": [
                    {
                        "external_reference": "ERP-PMT-002",
                        "invoice_number": invoice.invoice_number,
                        "amount": "5.0000",
                        "currency": "USD",
                        "notes": "Overpayment",
                    }
                ],
            },
            format="json",
        )
        self._auth_request(conflict_request, self.finance_operator)
        conflict_response = batch_view(conflict_request)
        self.assertEqual(conflict_response.status_code, 201)
        self.assertEqual(conflict_response.data["status"], ExternalRemittanceBatchStatus.PARTIAL)
        self.assertEqual(conflict_response.data["conflict_count"], 1)
        self.assertEqual(conflict_response.data["items"][0]["status"], "CONFLICT")

    def test_unauthorized_role_cannot_approve_finance_review(self) -> None:
        invoice = Invoice.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            invoice_number="INV-FIN-403",
            period_start=date.today(),
            period_end=date.today(),
            status=InvoiceStatus.FINALIZED,
            generated_by=self.operator.staff_name,
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        InvoiceFinanceApproval.objects.create(
            invoice=invoice,
            status=FinanceApprovalStatus.PENDING,
            submitted_by=self.operator.staff_name,
            creator=self.operator.staff_name,
            openid=self.warehouse.openid,
        )
        approve_view = InvoiceViewSet.as_view({"post": "approve_finance_review"})
        approve_request = self.factory.post(
            f"/api/reporting/invoices/{invoice.id}/approve-finance-review/",
            {"notes": "Nope"},
            format="json",
        )
        self._auth_request(approve_request, self.viewer)
        approve_response = approve_view(approve_request, pk=invoice.id)
        self.assertEqual(approve_response.status_code, 403)
