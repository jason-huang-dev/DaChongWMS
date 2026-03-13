from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.exceptions import ValidationError
from rest_framework.test import APIRequestFactory, force_authenticate

from userprofile.models import Users

from .models import ListModel
from .serializers import StaffPostSerializer
from .views import StaffViewSet


def create_user_profile(**overrides: Any) -> Users:
    defaults = {
        "user_id": 1,
        "name": "Staff Member",
        "vip": 1,
        "openid": "staff-openid",
        "appid": "staff-appid",
        "t_code": "t-code",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


def create_staff(**overrides: Any) -> ListModel:
    defaults = {
        "staff_name": "Alice",
        "staff_type": "Manager",
        "check_code": 8888,
        "openid": "staff-openid",
    }
    defaults.update(overrides)
    return ListModel.objects.create(**defaults)


class StaffModelTests(TestCase):
    def test_str_contains_staff_name(self) -> None:
        staff = create_staff(staff_name="Charlie", openid="openid-1")
        self.assertIn("Charlie", str(staff))


class StaffViewSetTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.auth_token = SimpleNamespace(openid="staff-openid")
        self.user = get_user_model().objects.create_user(username="staff-admin", password="password")
        self.profile = create_user_profile(name="Alice Employee", openid=self.auth_token.openid)
        self.staff = create_staff(openid=self.auth_token.openid, staff_name=self.profile.name)

    def _view_instance(self) -> StaffViewSet:
        view = StaffViewSet()
        view.request = SimpleNamespace(auth=self.auth_token)
        view.kwargs = {}
        return view

    def test_get_queryset_filters_by_openid(self) -> None:
        create_staff(openid="other-openid", staff_name="Hidden")
        queryset = self._view_instance().get_queryset()
        self.assertEqual(queryset.count(), 1)
        self.assertEqual(queryset.first().staff_name, self.profile.name)

    def test_perform_create_rejects_duplicate_staff_names(self) -> None:
        payload = {
            "staff_name": self.profile.name,
            "staff_type": "Manager",
            "check_code": 8888,
        }
        serializer = StaffPostSerializer(data=payload)
        self.assertTrue(serializer.is_valid())
        with self.assertRaises(ValidationError):
            self._view_instance().perform_create(serializer)

    def test_list_with_valid_check_code_succeeds(self) -> None:
        view = StaffViewSet.as_view({"get": "list"})
        request = self.factory.get(
            "/api/staff/",
            {"staff_name": self.staff.staff_name, "check_code": self.staff.check_code},
        )
        force_authenticate(request, user=self.user, token=self.auth_token)
        response = view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)

    def test_list_with_invalid_check_code_increments_counter(self) -> None:
        view = StaffViewSet.as_view({"get": "list"})
        request = self.factory.get(
            "/api/staff/",
            {"staff_name": self.staff.staff_name, "check_code": 1234},
        )
        force_authenticate(request, user=self.user, token=self.auth_token)
        response = view(request)
        self.assertEqual(response.status_code, 400)
        self.staff.refresh_from_db()
        self.assertEqual(self.staff.error_check_code_counter, 1)
