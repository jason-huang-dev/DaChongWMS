from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import resolve, reverse
from rest_framework.exceptions import APIException
from rest_framework.test import APIRequestFactory, force_authenticate

from userprofile.models import Users

from .filter import WarehouseFilter
from .models import Warehouse
from .serializers import (
    WarehouseGetSerializer,
    WarehousePartialUpdateSerializer,
    WarehousePostSerializer,
    WarehouseUpdateSerializer,
)
from .views import WarehouseViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Warehouse Owner",
        "vip": 1,
        "openid": "warehouse-openid",
        "appid": "warehouse-appid",
        "t_code": "warehouse-t",
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
        "openid": "warehouse-openid",
    }
    defaults.update(overrides)
    return Warehouse.objects.create(**defaults)


class WarehouseModelTest(TestCase):
    def test_str_shows_name(self) -> None:
        warehouse = create_warehouse(warehouse_name="Primary", openid="openid-1")
        self.assertIn("Primary", str(warehouse))


class WarehouseViewSetTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth = SimpleNamespace(openid="warehouse-openid", appid="warehouse-appid")
        self.user = get_user_model().objects.create_user(username="api", password="password")
        create_user_profile()

    def _view_instance(self) -> WarehouseViewSet:
        view = WarehouseViewSet()
        view.request = SimpleNamespace(auth=self.auth)
        view.kwargs = {}
        return view

    def test_get_queryset_filters_by_openid(self) -> None:
        create_warehouse(openid=self.auth.openid, warehouse_name="Visible")
        create_warehouse(openid="other", warehouse_name="Hidden")
        queryset = self._view_instance().get_queryset()
        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.first().warehouse_name, "Visible")

    def test_get_queryset_with_pk_returns_single_record(self) -> None:
        warehouse = create_warehouse(openid=self.auth.openid)
        view = self._view_instance()
        view.kwargs = {"pk": str(warehouse.pk)}
        self.assertEqual(view.get_queryset().get().pk, warehouse.pk)

    def test_serializer_class_switches_by_action(self) -> None:
        view = self._view_instance()
        view.action = "list"
        self.assertIs(view.get_serializer_class(), WarehouseGetSerializer)
        view.action = "create"
        self.assertIs(view.get_serializer_class(), WarehousePostSerializer)
        view.action = "update"
        self.assertIs(view.get_serializer_class(), WarehouseUpdateSerializer)
        view.action = "partial_update"
        self.assertIs(view.get_serializer_class(), WarehousePartialUpdateSerializer)
        view.action = "unknown"
        self.assertIs(view.get_serializer_class(), WarehouseGetSerializer)

    def test_perform_create_rejects_long_name(self) -> None:
        payload = {
            "warehouse_name": "X" * 45,
            "warehouse_city": "City",
            "warehouse_address": "Addr",
            "warehouse_contact": "Contact",
            "warehouse_manager": "Manager",
            "creator": "Creator",
        }
        serializer = WarehousePostSerializer(data=payload)
        self.assertTrue(serializer.is_valid())
        view = self._view_instance()
        serializer.validated_data["warehouse_name"] = "X" * 46
        with self.assertRaises(APIException):
            view.perform_create(serializer)

    def test_perform_create_disallows_multiple_active_warehouses(self) -> None:
        create_warehouse(openid=self.auth.openid, is_delete=False)
        payload = {
            "warehouse_name": "New",
            "warehouse_city": "City",
            "warehouse_address": "Addr",
            "warehouse_contact": "Contact",
            "warehouse_manager": "Manager",
            "creator": "Creator",
        }
        serializer = WarehousePostSerializer(data=payload)
        self.assertTrue(serializer.is_valid())
        view = self._view_instance()
        with self.assertRaises(APIException):
            view.perform_create(serializer)

    def test_perform_update_validates_name_length(self) -> None:
        warehouse = create_warehouse(openid=self.auth.openid)
        data = {
            "warehouse_name": "Y" * 45,
            "warehouse_city": warehouse.warehouse_city,
            "warehouse_address": warehouse.warehouse_address,
            "warehouse_contact": warehouse.warehouse_contact,
            "warehouse_manager": warehouse.warehouse_manager,
            "creator": warehouse.creator,
        }
        serializer = WarehouseUpdateSerializer(instance=warehouse, data=data)
        self.assertTrue(serializer.is_valid())
        serializer.validated_data["warehouse_name"] = "Y" * 46
        with self.assertRaises(APIException):
            self._view_instance().perform_update(serializer)

    def test_perform_update_saves_valid_payloads(self) -> None:
        warehouse = create_warehouse(openid=self.auth.openid)
        data = {
            "warehouse_name": "Valid",
            "warehouse_city": "Boston",
            "warehouse_address": "New Addr",
            "warehouse_contact": "555",
            "warehouse_manager": "Manager",
            "creator": "Creator",
        }
        serializer = WarehouseUpdateSerializer(instance=warehouse, data=data)
        self.assertTrue(serializer.is_valid())
        self._view_instance().perform_update(serializer)
        warehouse.refresh_from_db()
        self.assertEqual(warehouse.warehouse_city, "Boston")

    def test_destroy_soft_deletes_instance(self) -> None:
        warehouse = create_warehouse(openid=self.auth.openid)
        view = WarehouseViewSet.as_view({"delete": "destroy"})
        request = self.factory.delete(f"/api/warehouse/{warehouse.pk}/")
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request, pk=warehouse.pk)
        self.assertEqual(response.status_code, 200)
        warehouse.refresh_from_db()
        self.assertTrue(warehouse.is_delete)

    def test_list_endpoint_returns_paginated_results(self) -> None:
        create_warehouse(openid=self.auth.openid)
        create_warehouse(openid="other")
        view = WarehouseViewSet.as_view({"get": "list"})
        request = self.factory.get("/api/warehouse/")
        force_authenticate(request, user=self.user, token=self.auth)
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(len(response.data["results"]), 1)


class WarehouseFilterTests(TestCase):
    def test_filter_supports_partial_name_lookup(self) -> None:
        create_warehouse(warehouse_name="Main Hub", openid="openid-1")
        create_warehouse(warehouse_name="Secondary", openid="openid-1")
        filtr = WarehouseFilter(data={"warehouse_name__icontains": "main"}, queryset=Warehouse.objects.all())
        self.assertEqual(filtr.qs.count(), 1)
        self.assertEqual(filtr.qs.first().warehouse_name, "Main Hub")


class WarehouseUrlsTests(TestCase):
    def test_reverses_use_expected_paths(self) -> None:
        self.assertEqual(reverse("warehouse-list"), "/api/warehouse/")
        self.assertEqual(reverse("warehouse-detail", kwargs={"pk": 1}), "/api/warehouse/1/")
        self.assertEqual(resolve("/api/warehouse/").url_name, "warehouse-list")
