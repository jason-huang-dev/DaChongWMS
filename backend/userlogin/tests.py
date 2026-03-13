from __future__ import annotations

import json

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from staff.models import ListModel
from userprofile.models import Users


class LoginViewTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("userlogin:login")
        self.auth_user = get_user_model().objects.create_user(username="worker", password="password123")
        self.profile = Users.objects.create(
            user_id=self.auth_user.id,
            name="Worker Name",
            vip=1,
            openid="worker-openid",
            appid="worker-appid",
            t_code="t-code",
            ip="127.0.0.1",
        )
        self.staff = ListModel.objects.create(
            staff_name=self.profile.name,
            staff_type="Manager",
            check_code=8888,
            openid=self.profile.openid,
        )

    def test_login_success_returns_staff_payload(self) -> None:
        response = self.client.post(
            self.url,
            data=json.dumps({"name": "worker", "password": "password123"}),
            content_type="application/json",
        )
        payload = response.json()
        self.assertEqual(response.status_code, 200)
        self.assertEqual(payload["data"]["openid"], self.profile.openid)
        self.assertEqual(payload["data"]["user_id"], self.staff.id)

    def test_login_requires_credentials(self) -> None:
        response = self.client.post(self.url, data=json.dumps({}), content_type="application/json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["msg"], "User name and password are required")

    def test_login_fails_when_staff_record_missing(self) -> None:
        self.staff.delete()
        response = self.client.post(
            self.url,
            data=json.dumps({"name": "worker", "password": "password123"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["msg"], "Staff record not found")
