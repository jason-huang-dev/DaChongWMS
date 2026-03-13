from __future__ import annotations

from decimal import Decimal
from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.exceptions import APIException
from rest_framework.test import APIRequestFactory, force_authenticate

from staff.models import ListModel as Staff
from userprofile.models import Users
from warehouse.models import Warehouse

from .models import Location, LocationLock, LocationStatus, LocationType, Zone, ZoneUsage
from .serializers import LocationLockSerializer, LocationSerializer
from .views import LocationLockViewSet, LocationViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Location Owner",
        "vip": 1,
        "openid": "location-openid",
        "appid": "location-appid",
        "t_code": "location-t",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_warehouse(**overrides: Any) -> Warehouse:
    defaults = {
        "warehouse_name": "Main Warehouse",
        "warehouse_city": "New York",
        "warehouse_address": "123 Example St",
        "warehouse_contact": "123-456",
        "warehouse_manager": "Manager",
        "creator": "creator",
        "openid": "location-openid",
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
        "openid": "location-openid",
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


def create_staff(**overrides: Any) -> Staff:
    defaults = {
        "staff_name": "Manager Operator",
        "staff_type": "Manager",
        "check_code": 1234,
        "openid": "location-openid",
    }
    defaults.update(overrides)
    return Staff.objects.create(**defaults)


class LocationModelTests(TestCase):
    def test_str_returns_location_code(self) -> None:
        location = create_location(location_code="B-01-01-01")
        self.assertEqual(str(location), "B-01-01-01")


class LocationViewSetTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="location-openid", appid="location-appid")
        self.user = get_user_model().objects.create_user(username="api", password="password")
        create_user_profile()
        self.operator = create_staff()

    def _view_instance(self) -> LocationViewSet:
        view = LocationViewSet()
        view.request = SimpleNamespace(auth=self.auth)
        view.kwargs = {}
        return view

    def test_get_queryset_filters_by_openid(self) -> None:
        create_location()
        other_warehouse = create_warehouse(openid="other-openid", warehouse_name="Other")
        create_location(
            warehouse=other_warehouse,
            zone=create_zone(warehouse=other_warehouse, openid="other-openid", zone_code="OTH", zone_name="Other"),
            location_type=create_location_type(openid="other-openid", type_code="BIN"),
            openid="other-openid",
            location_code="O-01-01-01",
        )
        queryset = self._view_instance().get_queryset()
        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.first().location_code, "A-01-01-01")

    def test_perform_create_rejects_zone_from_another_warehouse(self) -> None:
        warehouse = create_warehouse()
        other_warehouse = create_warehouse(openid=self.auth.openid, warehouse_name="Overflow")
        serializer = LocationSerializer(
            data={
                "warehouse": warehouse.pk,
                "zone": create_zone(warehouse=other_warehouse, zone_code="OVR", zone_name="Overflow").pk,
                "location_type": create_location_type().pk,
                "location_code": "A-02-01-01",
                "location_name": "Overflow Bin",
                "status": LocationStatus.AVAILABLE,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        view = self._view_instance()
        view.request.META = {"HTTP_OPERATOR": str(self.operator.id)}
        with self.assertRaises(APIException):
            view.perform_create(serializer)

    def test_create_defaults_barcode_to_location_code(self) -> None:
        warehouse = create_warehouse()
        zone = create_zone(warehouse=warehouse)
        location_type = create_location_type(openid=warehouse.openid)
        serializer = LocationSerializer(
            data={
                "warehouse": warehouse.pk,
                "zone": zone.pk,
                "location_type": location_type.pk,
                "location_code": "A-03-01-01",
                "location_name": "Overflow Bin",
                "barcode": "",
                "status": LocationStatus.AVAILABLE,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        view = self._view_instance()
        view.request.META = {"HTTP_OPERATOR": str(self.operator.id)}
        view.perform_create(serializer)
        self.assertEqual(Location.objects.get(location_code="A-03-01-01").barcode, "A-03-01-01")

    def test_destroy_soft_deletes_location(self) -> None:
        location = create_location()
        view = LocationViewSet.as_view({"delete": "destroy"})
        request = self.factory.delete(f"/api/locations/{location.pk}/", HTTP_OPERATOR=str(self.operator.id))
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=location.pk)
        self.assertEqual(response.status_code, 200)
        location.refresh_from_db()
        self.assertTrue(location.is_delete)

    def test_create_requires_authorized_topology_role(self) -> None:
        warehouse = create_warehouse()
        zone = create_zone(warehouse=warehouse)
        location_type = create_location_type(openid=warehouse.openid)
        denied_operator = create_staff(staff_name="Inbound Operator", staff_type="Inbound")
        view = LocationViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/locations/",
            {
                "warehouse": warehouse.pk,
                "zone": zone.pk,
                "location_type": location_type.pk,
                "location_code": "A-04-01-01",
                "location_name": "Inbound Bin",
                "status": LocationStatus.AVAILABLE,
            },
            format="json",
            HTTP_OPERATOR=str(denied_operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 403)

    def test_create_sets_creator_from_operator(self) -> None:
        warehouse = create_warehouse()
        zone = create_zone(warehouse=warehouse)
        location_type = create_location_type(openid=warehouse.openid)
        view = LocationViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/locations/",
            {
                "warehouse": warehouse.pk,
                "zone": zone.pk,
                "location_type": location_type.pk,
                "location_code": "A-05-01-01",
                "location_name": "Manager Bin",
                "status": LocationStatus.AVAILABLE,
            },
            format="json",
            HTTP_OPERATOR=str(self.operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["creator"], self.operator.staff_name)


class LocationLockViewSetTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="location-openid", appid="location-appid")
        self.user = get_user_model().objects.create_user(username="lock-api", password="password")
        create_user_profile()
        self.operator = create_staff(staff_name="Stock Controller", staff_type="StockControl")

    def _view_instance(self) -> LocationLockViewSet:
        view = LocationLockViewSet()
        view.request = SimpleNamespace(auth=self.auth)
        view.kwargs = {}
        return view

    def test_creating_active_lock_marks_location_locked(self) -> None:
        location = create_location()
        serializer = LocationLockSerializer(
            data={
                "location": location.pk,
                "reason": "Inventory Hold",
                "notes": "",
                "locked_by": "Supervisor",
                "is_active": True,
            }
        )
        self.assertTrue(serializer.is_valid(), serializer.errors)
        view = self._view_instance()
        view.request.META = {"HTTP_OPERATOR": str(self.operator.id)}
        view.perform_create(serializer)
        location.refresh_from_db()
        self.assertTrue(location.is_locked)
        self.assertEqual(location.status, LocationStatus.BLOCKED)

    def test_destroying_last_active_lock_unlocks_location(self) -> None:
        location = create_location(status=LocationStatus.BLOCKED, is_locked=True)
        lock = LocationLock.objects.create(
            location=location,
            reason="Maintenance",
            locked_by="Supervisor",
            is_active=True,
            creator="tester",
            openid=location.openid,
        )
        view = LocationLockViewSet.as_view({"delete": "destroy"})
        request = self.factory.delete(f"/api/locations/locks/{lock.pk}/", HTTP_OPERATOR=str(self.operator.id))
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=lock.pk)
        self.assertEqual(response.status_code, 200)
        location.refresh_from_db()
        lock.refresh_from_db()
        self.assertTrue(lock.is_delete)
        self.assertFalse(location.is_locked)
        self.assertEqual(location.status, LocationStatus.AVAILABLE)

    def test_lock_create_requires_lock_role(self) -> None:
        location = create_location()
        denied_operator = create_staff(staff_name="Inbound Operator", staff_type="Inbound")
        view = LocationLockViewSet.as_view({"post": "create"})
        request = self.factory.post(
            "/api/locations/locks/",
            {
                "location": location.pk,
                "reason": "Blocked",
                "notes": "",
                "locked_by": "Inbound Operator",
                "is_active": True,
            },
            format="json",
            HTTP_OPERATOR=str(denied_operator.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 403)


class LocationUrlsTests(TestCase):
    def test_routes_match_expected_paths(self) -> None:
        self.assertEqual(reverse("locations:location-list"), "/api/locations/")
        self.assertEqual(reverse("locations:zone-list"), "/api/locations/zones/")
        self.assertEqual(reverse("locations:lock-detail", kwargs={"pk": 1}), "/api/locations/locks/1/")
        self.assertEqual(resolve("/api/locations/").url_name, "location-list")
