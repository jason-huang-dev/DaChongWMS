from __future__ import annotations

import json

from django.conf import settings
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
import pyotp

from staff.models import ListModel as Staff
from userprofile.models import Users

from mfa.services import issue_totp_enrollment, verify_totp_enrollment
from userlogin.services import resolve_workspace_identity


class MFAApiTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.auth_user = get_user_model().objects.create_user(
            username="mfa-user",
            email="mfa-user@example.com",
            password="StrongPassword123!",
        )
        self.profile = Users.objects.create(
            user_id=self.auth_user.id,
            name="mfa-user",
            vip=1,
            openid="mfa-openid",
            appid="mfa-appid",
            developer=False,
            t_code="mfa-t-code",
            ip="127.0.0.1",
        )
        self.staff = Staff.objects.create(
            staff_name="mfa-user",
            staff_type="Manager",
            check_code=8888,
            openid=self.profile.openid,
        )
        self.api_client = APIClient()
        self.api_client.credentials(HTTP_TOKEN=self.profile.openid, HTTP_OPERATOR=str(self.staff.id))
        self.status_url = reverse("mfa:status")
        self.enroll_url = reverse("mfa:totp-enroll")
        self.enroll_verify_url = reverse("mfa:totp-enroll-verify")
        self.challenge_verify_url = reverse("mfa:challenge-verify")
        self.login_url = reverse("userlogin:login")

    def _create_verified_enrollment(self) -> str:
        identity = resolve_workspace_identity(auth_user=self.auth_user)
        setup = issue_totp_enrollment(
            auth_user=identity.auth_user,
            openid=identity.profile.openid,
            creator=self.staff.staff_name,
            email=self.auth_user.email,
        )
        code = pyotp.TOTP(setup.secret).now()
        verify_totp_enrollment(enrollment=setup.enrollment, code=code, creator=self.staff.staff_name)
        return setup.secret

    def test_status_reports_enrollment_required_before_setup(self) -> None:
        response = self.api_client.get(self.status_url)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.json()["enrollment_required"])
        self.assertFalse(response.json()["has_verified_enrollment"])

    def test_totp_enrollment_can_be_created_and_verified(self) -> None:
        create_response = self.api_client.post(self.enroll_url, {"label": "Warehouse phone"}, format="json")
        self.assertEqual(create_response.status_code, 201)
        create_payload = create_response.json()
        self.assertEqual(create_payload["label"], "Warehouse phone")
        self.assertIn("otpauth://totp/", create_payload["provisioning_uri"])

        code = pyotp.TOTP(create_payload["secret"]).now()
        verify_response = self.api_client.post(
            self.enroll_verify_url,
            {"enrollment_id": create_payload["enrollment_id"], "code": code},
            format="json",
        )
        self.assertEqual(verify_response.status_code, 200)
        verify_payload = verify_response.json()
        self.assertTrue(verify_payload["verified"])
        self.assertEqual(len(verify_payload["recovery_codes"]), 8)

        status_response = self.api_client.get(self.status_url)
        self.assertEqual(status_response.status_code, 200)
        self.assertFalse(status_response.json()["enrollment_required"])
        self.assertTrue(status_response.json()["has_verified_enrollment"])
        self.assertEqual(status_response.json()["recovery_codes_remaining"], 8)

    def test_login_requires_totp_challenge_when_enrollment_exists(self) -> None:
        secret = self._create_verified_enrollment()

        login_response = self.client.post(
            self.login_url,
            data=json.dumps({"name": "mfa-user", "password": "StrongPassword123!"}),
            content_type="application/json",
        )
        self.assertEqual(login_response.status_code, 202)
        self.assertTrue(login_response.json()["data"]["mfa_required"])

        challenge_response = self.client.post(
            self.challenge_verify_url,
            data=json.dumps(
                {
                    "challenge_id": login_response.json()["data"]["challenge_id"],
                    "code": pyotp.TOTP(secret).now(),
                }
            ),
            content_type="application/json",
        )
        self.assertEqual(challenge_response.status_code, 200)
        self.assertTrue(challenge_response.json()["data"]["mfa_verified"])
        self.assertEqual(challenge_response.json()["data"]["openid"], self.profile.openid)
        self.assertNotIn(settings.SESSION_COOKIE_NAME, challenge_response.cookies)
        self.assertIsNone(self.client.session.get("_auth_user_id"))

    def test_recovery_code_can_complete_a_challenge_once(self) -> None:
        create_response = self.api_client.post(self.enroll_url, {}, format="json")
        code = pyotp.TOTP(create_response.json()["secret"]).now()
        verify_response = self.api_client.post(
            self.enroll_verify_url,
            {"enrollment_id": create_response.json()["enrollment_id"], "code": code},
            format="json",
        )
        recovery_code = verify_response.json()["recovery_codes"][0]

        login_response = self.client.post(
            self.login_url,
            data=json.dumps({"name": "mfa-user", "password": "StrongPassword123!"}),
            content_type="application/json",
        )
        challenge_id = login_response.json()["data"]["challenge_id"]

        challenge_response = self.client.post(
            self.challenge_verify_url,
            data=json.dumps({"challenge_id": challenge_id, "code": recovery_code}),
            content_type="application/json",
        )
        self.assertEqual(challenge_response.status_code, 200)
        self.assertEqual(challenge_response.json()["data"]["mfa_method"], "RECOVERY_CODE")

        second_login = self.client.post(
            self.login_url,
            data=json.dumps({"name": "mfa-user", "password": "StrongPassword123!"}),
            content_type="application/json",
        )
        second_challenge = self.client.post(
            self.challenge_verify_url,
            data=json.dumps({"challenge_id": second_login.json()["data"]["challenge_id"], "code": recovery_code}),
            content_type="application/json",
        )
        self.assertEqual(second_challenge.status_code, 400)
