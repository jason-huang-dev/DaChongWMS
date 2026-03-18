from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from automation.models import BackgroundTask, BackgroundTaskType
from automation.services import run_background_tasks
from catalog.goods.models import ListModel as Goods
from customer.models import ListModel as Customer
from locations.models import Location, LocationStatus, LocationType, Zone, ZoneUsage
from operations.outbound.models import SalesOrder, Shipment
from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import CarrierBooking, CarrierBookingStatus, IntegrationJob, IntegrationJobStatus, IntegrationLog, WebhookEventStatus
from .views import CarrierBookingViewSet, WebhookEventViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Integration Owner",
        "vip": 1,
        "openid": "integration-openid",
        "appid": "integration-appid",
        "t_code": "integration-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Integration Manager",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "integration-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Integration Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "900 Sync Ave",
        "warehouse_contact": "555-9900",
        "warehouse_manager": "Sync Lead",
        "creator": "creator",
        "openid": "integration-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


def create_zone(**overrides: Any) -> Zone:
    warehouse = overrides.pop("warehouse", None) or create_warehouse()
    defaults = {
        "warehouse": warehouse,
        "zone_code": "SHP",
        "zone_name": "Shipping",
        "usage": ZoneUsage.SHIPPING,
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
        "type_code": "SHIP",
        "type_name": "Shipping Stage",
        "picking_enabled": True,
        "putaway_enabled": False,
        "allow_mixed_sku": True,
        "max_weight": Decimal("1000.00"),
        "max_volume": Decimal("4.0000"),
        "creator": "creator",
        "openid": "integration-openid",
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
        "location_code": "SHIP-01",
        "location_name": "Shipping 01",
        "barcode": "SHIP-01",
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
        "customer_name": "Integration Customer",
        "customer_city": "New York",
        "customer_address": "55 Carrier Ave",
        "customer_contact": "555-1100",
        "customer_manager": "Carrier Lead",
        "creator": "creator",
        "openid": "integration-openid",
    }
    defaults.update(overrides)
    return Customer.objects.create(**defaults)


def create_goods(**overrides: Any) -> Goods:
    defaults = {
        "goods_code": "SKU-INT-001",
        "goods_desc": "Integration Widget",
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
        "bar_code": "BAR-INT-001",
        "openid": "integration-openid",
    }
    defaults.update(overrides)
    return Goods.objects.create(**defaults)


class IntegrationsApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="integration-openid", appid="integration-appid")
        self.user = get_user_model().objects.create_user(username="integrations-api", password="password")
        create_user_profile()
        self.operator = create_staff()
        self.viewer = create_staff(staff_name="Viewer", staff_type="Viewer", check_code=2222)
        self.warehouse = create_warehouse()
        self.shipping_zone = create_zone(warehouse=self.warehouse)
        self.shipping_type = create_location_type(openid=self.warehouse.openid)
        self.shipping_location = create_location(warehouse=self.warehouse, zone=self.shipping_zone, location_type=self.shipping_type)
        self.customer = create_customer(openid=self.warehouse.openid)
        self.goods = create_goods(openid=self.warehouse.openid)
        self.sales_order = SalesOrder.objects.create(
            warehouse=self.warehouse,
            customer=self.customer,
            staging_location=self.shipping_location,
            order_number="SO-INT-001",
            creator="creator",
            openid=self.warehouse.openid,
        )
        self.shipment = Shipment.objects.create(
            sales_order=self.sales_order,
            warehouse=self.warehouse,
            staging_location=self.shipping_location,
            shipment_number="SHP-INT-001",
            shipped_by="creator",
            creator="creator",
            openid=self.warehouse.openid,
        )

    def _auth_request(self, request, operator: Staff | None = None) -> None:
        if operator is not None:
            request.META["HTTP_OPERATOR"] = str(operator.id)
        force_authenticate(request, user=self.user, token=self.auth)

    def test_webhook_intake_queues_processing_job_without_operator_header(self) -> None:
        view = WebhookEventViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/integrations/webhooks/",
            {
                "warehouse": self.warehouse.pk,
                "system_type": "ERP",
                "source_system": "netsuite",
                "event_type": "inventory.updated",
                "event_key": "evt-1001",
                "payload": {"sku": "SKU-INT-001", "qty": 10},
            },
            format="json",
        )
        self._auth_request(request)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        job = IntegrationJob.objects.get(source_webhook_id=response.data["id"])
        self.assertEqual(response.data["status"], WebhookEventStatus.QUEUED)
        self.assertEqual(job.status, IntegrationJobStatus.QUEUED)
        self.assertTrue(
            BackgroundTask.objects.filter(
                integration_job=job,
                task_type=BackgroundTaskType.PROCESS_INTEGRATION_JOB,
            ).exists()
        )
        self.assertTrue(IntegrationLog.objects.filter(webhook_event_id=response.data["id"]).exists())

    def test_webhook_process_marks_event_processed(self) -> None:
        webhook_view = WebhookEventViewSet.as_view({"post": "create"})
        create_request = self.factory.post(
            "/api/integrations/webhooks/",
            {
                "source_system": "carrier-cloud",
                "event_type": "label.ready",
                "event_key": "evt-2001",
                "payload": {"shipment": "SHP-INT-001"},
            },
            format="json",
        )
        self._auth_request(create_request)
        create_response = webhook_view(create_request)
        self.assertEqual(create_response.status_code, 201)

        process_view = WebhookEventViewSet.as_view({"post": "process"})
        process_request = self.factory.post(
            f"/api/integrations/webhooks/{create_response.data['id']}/process/",
            {"response_payload": {"accepted": True}},
            format="json",
        )
        self._auth_request(process_request, self.operator)
        process_response = process_view(process_request, pk=create_response.data["id"])
        self.assertEqual(process_response.status_code, 200)
        self.assertEqual(process_response.data["status"], WebhookEventStatus.PROCESSED)
        self.assertEqual(IntegrationJob.objects.get(source_webhook_id=create_response.data["id"]).status, IntegrationJobStatus.SUCCEEDED)

    def test_carrier_booking_and_label_generation_create_jobs_and_logs(self) -> None:
        booking_view = CarrierBookingViewSet.as_view({"post": "create"})
        booking_request = self.factory.post(
            "/api/integrations/carrier-bookings/",
            {
                "warehouse": self.warehouse.pk,
                "shipment": self.shipment.pk,
                "booking_number": "CB-1001",
                "carrier_code": "UPS",
                "service_level": "GROUND",
                "package_count": 2,
                "total_weight": "15.5000",
            },
            format="json",
        )
        self._auth_request(booking_request, self.operator)
        booking_response = booking_view(booking_request)
        self.assertEqual(booking_response.status_code, 201)
        booking = CarrierBooking.objects.get(pk=booking_response.data["id"])
        self.assertEqual(booking.status, CarrierBookingStatus.OPEN)
        self.assertTrue(BackgroundTask.objects.filter(integration_job=booking.booking_job).exists())

        run_background_tasks(worker_name="integration-test", limit=5, include_schedules=False)
        booking.refresh_from_db()
        self.assertEqual(booking.status, CarrierBookingStatus.BOOKED)

        label_view = CarrierBookingViewSet.as_view({"post": "generate_label"})
        label_request = self.factory.post(
            f"/api/integrations/carrier-bookings/{booking.id}/generate-label/",
            {"label_format": "PDF"},
            format="json",
        )
        self._auth_request(label_request, self.operator)
        label_response = label_view(label_request, pk=booking.id)
        self.assertEqual(label_response.status_code, 200)
        booking.refresh_from_db()
        self.assertTrue(BackgroundTask.objects.filter(integration_job=booking.label_job).exists())
        run_background_tasks(worker_name="integration-test", limit=5, include_schedules=False)
        booking.refresh_from_db()
        self.assertEqual(booking.status, CarrierBookingStatus.LABELED)
        self.assertTrue(booking.tracking_number)
        self.assertIn("LABEL|FORMAT=PDF", booking.label_document)
        self.assertEqual(IntegrationJob.objects.count(), 2)
        self.assertGreaterEqual(IntegrationLog.objects.filter(job__isnull=False).count(), 4)

    def test_retry_endpoint_requeues_failed_carrier_label_job(self) -> None:
        booking = CarrierBooking.objects.create(
            warehouse=self.warehouse,
            shipment=self.shipment,
            booking_number="CB-RETRY-1",
            carrier_code="UPS",
            service_level="GROUND",
            package_count=1,
            total_weight=Decimal("5.0000"),
            status=CarrierBookingStatus.BOOKED,
            creator="creator",
            openid=self.warehouse.openid,
            booked_by=self.operator.staff_name,
            booked_at=self.shipment.shipped_at,
        )
        label_job = IntegrationJob.objects.create(
            warehouse=self.warehouse,
            system_type="CARRIER",
            integration_name="UPS",
            job_type="LABEL_GENERATION",
            direction="EXPORT",
            status=IntegrationJobStatus.FAILED,
            reference_code=booking.booking_number,
            request_payload={"label_format": "PDF"},
            creator=self.operator.staff_name,
            triggered_by=self.operator.staff_name,
            last_error="Carrier label API timeout",
            openid=self.warehouse.openid,
        )
        booking.label_job = label_job
        booking.status = CarrierBookingStatus.FAILED
        booking.last_error = "Carrier label API timeout"
        booking.save(update_fields=["label_job", "status", "last_error", "update_time"])

        retry_view = CarrierBookingViewSet.as_view({"post": "retry"})
        retry_request = self.factory.post(
            f"/api/integrations/carrier-bookings/{booking.id}/retry/",
            {"label_format": "ZPL"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        self._auth_request(retry_request, self.operator)
        retry_response = retry_view(retry_request, pk=booking.id)
        self.assertEqual(retry_response.status_code, 202)

        booking.refresh_from_db()
        self.assertEqual(booking.status, CarrierBookingStatus.BOOKED)
        self.assertNotEqual(booking.label_job_id, label_job.id)
        self.assertEqual(booking.label_job.request_payload["label_format"], "ZPL")

    def test_rebook_endpoint_requeues_booking_with_overrides(self) -> None:
        booking = CarrierBooking.objects.create(
            warehouse=self.warehouse,
            shipment=self.shipment,
            booking_number="CB-REBOOK-1",
            carrier_code="UPS",
            service_level="GROUND",
            package_count=1,
            total_weight=Decimal("5.0000"),
            status=CarrierBookingStatus.FAILED,
            creator="creator",
            openid=self.warehouse.openid,
            last_error="Booking rejected by carrier",
        )
        booking_job = IntegrationJob.objects.create(
            warehouse=self.warehouse,
            system_type="CARRIER",
            integration_name="UPS",
            job_type="CARRIER_BOOKING",
            direction="EXPORT",
            status=IntegrationJobStatus.FAILED,
            reference_code=booking.booking_number,
            request_payload={"service_level": "GROUND"},
            creator=self.operator.staff_name,
            triggered_by=self.operator.staff_name,
            last_error="Booking rejected by carrier",
            openid=self.warehouse.openid,
        )
        booking.booking_job = booking_job
        booking.save(update_fields=["booking_job", "update_time"])

        rebook_view = CarrierBookingViewSet.as_view({"post": "rebook"})
        rebook_request = self.factory.post(
            f"/api/integrations/carrier-bookings/{booking.id}/rebook/",
            {
                "booking_number": "CB-REBOOK-2",
                "carrier_code": "FDX",
                "service_level": "PRIORITY",
                "package_count": 2,
                "total_weight": "7.5000",
                "external_reference": "external-2",
                "request_payload": {"priority": True},
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        self._auth_request(rebook_request, self.operator)
        rebook_response = rebook_view(rebook_request, pk=booking.id)
        self.assertEqual(rebook_response.status_code, 202)

        booking.refresh_from_db()
        self.assertEqual(booking.booking_number, "CB-REBOOK-2")
        self.assertEqual(booking.carrier_code, "FDX")
        self.assertEqual(booking.service_level, "PRIORITY")
        self.assertEqual(booking.status, CarrierBookingStatus.OPEN)
        self.assertEqual(booking.request_payload["priority"], True)
        self.assertNotEqual(booking.booking_job_id, booking_job.id)

    def test_cancel_endpoint_marks_carrier_booking_cancelled(self) -> None:
        booking = CarrierBooking.objects.create(
            warehouse=self.warehouse,
            shipment=self.shipment,
            booking_number="CB-CANCEL-1",
            carrier_code="UPS",
            service_level="GROUND",
            package_count=1,
            total_weight=Decimal("5.0000"),
            status=CarrierBookingStatus.FAILED,
            creator="creator",
            openid=self.warehouse.openid,
            last_error="Carrier timeout",
        )

        cancel_view = CarrierBookingViewSet.as_view({"post": "cancel"})
        cancel_request = self.factory.post(
            f"/api/integrations/carrier-bookings/{booking.id}/cancel/",
            {"cancel_reason": "Escalated to manual booking"},
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        self._auth_request(cancel_request, self.operator)
        cancel_response = cancel_view(cancel_request, pk=booking.id)
        self.assertEqual(cancel_response.status_code, 200)

        booking.refresh_from_db()
        self.assertEqual(booking.status, CarrierBookingStatus.CANCELLED)
        self.assertEqual(booking.last_error, "Escalated to manual booking")
        self.assertTrue(IntegrationLog.objects.filter(message="Carrier booking cancelled").exists())

    def test_viewer_cannot_create_carrier_booking(self) -> None:
        view = CarrierBookingViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/integrations/carrier-bookings/",
            {
                "warehouse": self.warehouse.pk,
                "shipment": self.shipment.pk,
                "booking_number": "CB-403",
                "carrier_code": "FDX",
                "package_count": 1,
                "total_weight": "4.0000",
            },
            format="json",
        )
        self._auth_request(request, self.viewer)
        response = view(request)
        self.assertEqual(response.status_code, 403)
