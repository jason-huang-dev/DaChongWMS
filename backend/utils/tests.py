from __future__ import annotations

import uuid
from typing import Any
from unittest import mock

from django.contrib.auth.models import AnonymousUser
from django.db import DatabaseError
from django.test import SimpleTestCase, TestCase
from rest_framework.exceptions import APIException, AuthenticationFailed, ValidationError
from rest_framework.request import Request
from rest_framework.test import APIRequestFactory

from userprofile.models import Users

from utils import apitag, datasolve, fbmsg, jwt as jwt_utils, logs, md5, my_exceptions, page, websocket
from utils.auth import Authtication
from utils.logs import Logdrf
from utils.throttle import VisitThrottle, _get_throttle_model


def create_user_profile(**overrides: Any) -> Users:
    unique = overrides.pop("unique", uuid.uuid4().hex)
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


class ApiTagTests(SimpleTestCase):
    def test_defaults_to_english(self) -> None:
        tags = apitag.api_tags(None)
        self.assertEqual(tags[0]["description"], "Arrive Manifest")

    def test_returns_chinese_tags_when_header_matches(self) -> None:
        tags = apitag.api_tags("zh-CN,zh;q=0.9")
        self.assertEqual(tags[0]["description"], "到货通知书")


class DataSolveTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.profile = create_user_profile(openid="openid-validator", appid="appid-validator")

    def test_data_validate_blocks_script_content(self) -> None:
        with self.assertRaises(APIException):
            datasolve.data_validate("<script>alert(1)</script>")

    def test_qty_validators_enforce_bounds(self) -> None:
        with self.assertRaises(APIException):
            datasolve.qty_0_data_validate(0)
        with self.assertRaises(APIException):
            datasolve.qty_data_validate(-1)
        self.assertEqual(datasolve.qty_data_validate(0), 0)

    def test_openid_and_appid_validation(self) -> None:
        self.assertEqual(datasolve.openid_validate(self.profile.openid), self.profile.openid)
        self.assertEqual(datasolve.appid_validate(self.profile.appid), self.profile.appid)

    def test_asn_and_dn_increment_logic(self) -> None:
        self.assertEqual(datasolve.asn_data_validate("ASN00000009"), "ASN00000010")
        self.assertEqual(datasolve.dn_data_validate("DN00000001"), "DN00000001")

    def test_numeric_helpers_and_barcode_roundtrip(self) -> None:
        self.assertEqual(datasolve.sumOfList([1, 2, 3, 4]), 10)
        self.assertTrue(datasolve.is_number("12.5"))
        secret = datasolve.secret_bar_code("{\"foo\": 1}")
        self.assertEqual(datasolve.verify_bar_code(secret)["foo"], 1)

    def test_transportation_calculate_applies_minimum(self) -> None:
        result = datasolve.transportation_calculate(weight=1, volume=1, weight_fee=1, volume_fee=1, min_fee=5)
        self.assertEqual(result, 5.0)


class JwtHelperTests(SimpleTestCase):
    def test_create_and_parse_token_round_trip(self) -> None:
        token = jwt_utils.create_token({"sub": "demo"})
        payload = jwt_utils.parse_payload(token)
        self.assertTrue(payload["status"])
        self.assertEqual(payload["data"]["sub"], "demo")

    def test_parse_payload_handles_invalid_token(self) -> None:
        payload = jwt_utils.parse_payload("invalid-token")
        self.assertFalse(payload["status"])
        self.assertEqual(payload["error"], "Token authentication failed")


class Md5HelperTests(SimpleTestCase):
    def test_md5_returns_hex_digest(self) -> None:
        digest = md5.Md5.md5("value")
        self.assertEqual(len(digest), 32)
        self.assertTrue(all(char in "0123456789abcdef" for char in digest))


class PaginationTests(SimpleTestCase):
    def test_pagination_defaults(self) -> None:
        paginator = page.MyPageNumberPagination()
        self.assertEqual(paginator.page_size, 30)
        self.assertEqual(paginator.max_page_size, 1000)
        self.assertEqual(paginator.page_query_param, "page")


class CustomExceptionHandlerTests(SimpleTestCase):
    def test_wrapps_known_exceptions(self) -> None:
        response = my_exceptions.custom_exception_handler(ValidationError({"name": ["missing"]}), {})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.data["status_code"], 400)

    def test_database_error_fallback(self) -> None:
        response = my_exceptions.custom_exception_handler(DatabaseError("boom"), {})
        self.assertIsNotNone(response)
        self.assertEqual(response.status_code, 500)
        self.assertEqual(response.data["detail"], "Database Error")

    def test_generic_exception_fallback(self) -> None:
        response = my_exceptions.custom_exception_handler(RuntimeError("boom"), {})
        self.assertIsNotNone(response)
        self.assertEqual(response.data["detail"], "Unhandled Error")


class AuthenticationTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.auth_backend = Authtication()
        self.factory = APIRequestFactory()
        self.profile = create_user_profile(openid="whitelist-openid")

    def _request(self, path: str = "/api/warehouse/") -> Request:
        return self.factory.get(path)

    def test_whitelisted_docs_bypass_authentication(self) -> None:
        request = self._request("/api/docs/")
        self.assertIsNone(self.auth_backend.authenticate(request))

    def test_missing_token_raises_error(self) -> None:
        request = self._request()
        with self.assertRaises(AuthenticationFailed):
            self.auth_backend.authenticate(request)

    def test_invalid_token_raises_error(self) -> None:
        request = self._request()
        request.META["HTTP_TOKEN"] = "unknown"
        with self.assertRaises(AuthenticationFailed):
            self.auth_backend.authenticate(request)

    def test_valid_token_returns_user_and_auth(self) -> None:
        request = self._request()
        request.META["HTTP_TOKEN"] = self.profile.openid
        user, auth = self.auth_backend.authenticate(request)
        self.assertEqual(user.pk, self.profile.pk)
        self.assertEqual(auth.openid, self.profile.openid)

    def test_fallback_when_legacy_model_missing(self) -> None:
        request = self._request()
        request.META["HTTP_TOKEN"] = "legacy-token"
        with mock.patch("utils.auth._LegacyUser", None):
            user, auth = self.auth_backend.authenticate(request)
        self.assertIsInstance(user, AnonymousUser)
        self.assertEqual(auth.openid, "legacy-token")


class LogsTests(SimpleTestCase):
    def test_get_log_model_handles_lookup_error(self) -> None:
        with mock.patch("utils.logs.apps.get_model", side_effect=LookupError):
            self.assertIsNone(logs._get_log_model())

    def test_logdrf_creates_entries_when_model_exists(self) -> None:
        class DummyManager:
            def __init__(self) -> None:
                self.create = mock.Mock()

        class DummyModel:
            objects = DummyManager()

        with mock.patch("utils.logs._get_log_model", return_value=DummyModel):
            Logdrf.logs("openid", "appid", "txn", "code")
        DummyModel.objects.create.assert_called_once_with(
            openid="openid",
            appid="appid",
            log_transaction="txn",
            log_code="code",
        )


class VisitThrottleTests(SimpleTestCase):
    def setUp(self) -> None:
        super().setUp()
        self.factory = APIRequestFactory()

    def test_whitelisted_path_is_allowed(self) -> None:
        throttle = VisitThrottle()
        request = self.factory.get("/api/docs/")
        self.assertTrue(throttle.allow_request(request, None))

    def test_allow_request_when_model_missing(self) -> None:
        throttle = VisitThrottle()
        request = self.factory.get("/api/warehouse/")
        request.META["REMOTE_ADDR"] = "127.0.0.1"
        with mock.patch("utils.throttle._get_throttle_model", return_value=None):
            self.assertTrue(throttle.allow_request(request, None))

    def test_wait_returns_none_without_timestamp(self) -> None:
        throttle = VisitThrottle()
        self.assertIsNone(throttle.wait())

    def test_get_throttle_model_handles_lookup_error(self) -> None:
        with mock.patch("utils.throttle.apps.get_model", side_effect=LookupError):
            self.assertIsNone(_get_throttle_model())


class WebsocketHelpersTests(SimpleTestCase):
    def test_parse_query_decodes_bytes(self) -> None:
        scope = {"query_string": b"sender=alice&openid=wx1"}
        self.assertEqual(websocket._parse_query(scope), {"sender": "alice", "openid": "wx1"})

    def test_sender_key_uses_sender_and_openid(self) -> None:
        scope = {"query_string": b"sender=alice&openid=wx1"}
        self.assertEqual(websocket._sender_key(scope), "alice-wx1")


class FbMsgTests(SimpleTestCase):
    def test_ret_payload_shape(self) -> None:
        payload = fbmsg.FBMsg.ret()
        self.assertEqual(payload["code"], "200")
        self.assertIn("msg", payload)
