from __future__ import annotations

import uuid

from typing import Any

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from .models import Users
from .serializers import UsersSerializer
from .views import UsersViewSet


def create_user_profile(**overrides: Any) -> Users:
    unique = uuid.uuid4().hex
    defaults = {
        "user_id": 1,
        "name": "Tester",
        "vip": 1,
        "openid": f"openid-{unique}",
        "appid": f"appid-{unique}",
        "t_code": f"t-{unique}",
        "ip": "127.0.0.1",
    }
    defaults.update(overrides)
    return Users.objects.create(**defaults)


class UsersModelTest(TestCase):
    def test_str(self) -> None:
        user = create_user_profile(name="Sample Tester")
        self.assertIn("Sample Tester", str(user))


class UsersSerializerTest(TestCase):
    def test_serializer_renders_expected_fields(self) -> None:
        user = create_user_profile()
        data = UsersSerializer(instance=user).data
        self.assertEqual(data["openid"], user.openid)
        self.assertIn("create_time", data)
        self.assertIn("update_time", data)


class UsersViewSetTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()
        self.view = UsersViewSet.as_view({"get": "list"})
        self.staff_user = get_user_model().objects.create_user(
            username="admin",
            password="password",
            is_staff=True,
        )
        self.profile = create_user_profile(name="Admin Visible")

    def test_list_requires_admin_permissions(self) -> None:
        request = self.factory.get("/userprofile/")
        response = self.view(request)
        self.assertEqual(response.status_code, 401)

    def test_list_returns_user_data_for_admin(self) -> None:
        request = self.factory.get("/userprofile/")
        force_authenticate(request, user=self.staff_user)
        response = self.view(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["results"][0]["openid"], self.profile.openid)
