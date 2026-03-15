from __future__ import annotations

import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from staff.models import ListModel
from userprofile.models import Users


class LoginViewTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("userlogin:login")
        self.signup_url = reverse("signup")
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
        self.assertNotIn(settings.SESSION_COOKIE_NAME, response.cookies)
        self.assertIsNone(self.client.session.get("_auth_user_id"))

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

    def test_signup_creates_auth_profile_and_staff_record(self) -> None:
        response = self.client.post(
            self.signup_url,
            data=json.dumps(
                {
                    "name": "new-manager",
                    "email": "new-manager@example.com",
                    "password1": "StrongPassword123!",
                    "password2": "StrongPassword123!",
                }
            ),
            content_type="application/json",
        )

        payload = response.json()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(payload["data"]["name"], "new-manager")
        self.assertEqual(payload["data"]["email"], "new-manager@example.com")
        self.assertTrue(payload["data"]["mfa_enrollment_required"])

        auth_user = get_user_model().objects.get(username="new-manager")
        profile = Users.objects.get(user_id=auth_user.id)
        staff = ListModel.objects.get(id=payload["data"]["user_id"])
        self.assertEqual(auth_user.email, "new-manager@example.com")
        self.assertFalse(profile.developer)
        self.assertEqual(profile.name, "new-manager")
        self.assertEqual(staff.staff_name, "new-manager")
        self.assertEqual(staff.staff_type, "Manager")
        self.assertNotIn(settings.SESSION_COOKIE_NAME, response.cookies)
        self.assertIsNone(self.client.session.get("_auth_user_id"))

    def test_signup_rejects_duplicate_username(self) -> None:
        response = self.client.post(
            self.signup_url,
            data=json.dumps(
                {
                    "name": "worker",
                    "email": "duplicate@example.com",
                    "password1": "StrongPassword123!",
                    "password2": "StrongPassword123!",
                }
            ),
            content_type="application/json",
        )

        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "1022")

    def test_signup_rejects_invalid_email_and_password_mismatch(self) -> None:
        invalid_email = self.client.post(
            self.signup_url,
            data=json.dumps(
                {
                    "name": "invalid-email",
                    "email": "bad-email",
                    "password1": "StrongPassword123!",
                    "password2": "StrongPassword123!",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(invalid_email.status_code, 400)
        self.assertEqual(invalid_email.json()["msg"], "Email is invalid")

        mismatched_password = self.client.post(
            self.signup_url,
            data=json.dumps(
                {
                    "name": "mismatch-user",
                    "email": "mismatch@example.com",
                    "password1": "StrongPassword123!",
                    "password2": "DifferentPassword123!",
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(mismatched_password.status_code, 400)
        self.assertEqual(mismatched_password.json()["code"], "1026")

    def test_signup_accepts_backend_service_host_used_by_vite_proxy(self) -> None:
        response = self.client.post(
            self.signup_url,
            data=json.dumps(
                {
                    "name": "proxy-signup",
                    "email": "proxy-signup@example.com",
                    "password1": "StrongPassword123!",
                    "password2": "StrongPassword123!",
                }
            ),
            content_type="application/json",
            HTTP_HOST="backend:8000",
        )

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["data"]["name"], "proxy-signup")
