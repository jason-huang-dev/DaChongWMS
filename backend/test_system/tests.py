from __future__ import annotations

import json
import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from capital.models import ListModel as Capital
from catalog.goods.models import ListModel as Goods
from catalog.goodsbrand.models import ListModel as GoodsBrand
from catalog.goodsclass.models import ListModel as GoodsClass
from catalog.goodscolor.models import ListModel as GoodsColor
from catalog.goodsorigin.models import ListModel as GoodsOrigin
from catalog.goodsshape.models import ListModel as GoodsShape
from catalog.goodsspecs.models import ListModel as GoodsSpecs
from catalog.goodsunit.models import ListModel as GoodsUnit
from customer.models import ListModel as Customer
from inventory.models import InventoryBalance, InventoryHold, InventoryMovement
from locations.models import Location, LocationLock, LocationStatus, LocationType, Zone
from payment.models import TransportationFeeListModel
from scanner.models import ListModel as Scanner
from staff.models import ListModel as Staff
from supplier.models import ListModel as Supplier
from userprofile.models import Users
from warehouse.models import Warehouse

from .services import DEFAULT_BOOTSTRAP_PASSWORD, DEFAULT_BOOTSTRAP_USERNAME


class TestSystemRegisterViewTests(TestCase):
    def setUp(self) -> None:
        super().setUp()
        self.url = reverse("test_system:register")
        self.login_url = reverse("userlogin:login")

    def test_register_bootstraps_a_full_demo_tenant_with_defaults(self) -> None:
        with tempfile.TemporaryDirectory() as media_root:
            with self.settings(MEDIA_ROOT=media_root, TEST_SYSTEM_ENABLED=True):
                with self.captureOnCommitCallbacks(execute=True):
                    response = self.client.post(
                        self.url,
                        data=json.dumps({}),
                        content_type="application/json",
                    )

                payload = response.json()
                self.assertEqual(response.status_code, 201)
                self.assertEqual(payload["data"]["name"], DEFAULT_BOOTSTRAP_USERNAME)
                self.assertTrue(payload["data"]["used_default_name"])
                self.assertTrue(payload["data"]["used_default_password"])
                self.assertEqual(payload["data"]["seed_summary"]["inventory_balances"], 4)
                self.assertEqual(payload["data"]["seed_summary"]["inventory_movements"], 5)

                auth_user = get_user_model().objects.get(username=DEFAULT_BOOTSTRAP_USERNAME)
                profile = Users.objects.get(user_id=auth_user.id)
                admin_staff = Staff.objects.get(id=payload["data"]["user_id"])
                self.assertEqual(admin_staff.staff_name, DEFAULT_BOOTSTRAP_USERNAME)
                self.assertEqual(admin_staff.staff_type, "Manager")
                self.assertEqual(Warehouse.objects.filter(openid=profile.openid, is_delete=False).count(), 1)
                self.assertEqual(Zone.objects.filter(openid=profile.openid, is_delete=False).count(), 4)
                self.assertEqual(LocationType.objects.filter(openid=profile.openid, is_delete=False).count(), 4)
                self.assertEqual(Location.objects.filter(openid=profile.openid, is_delete=False).count(), 5)
                self.assertEqual(
                    Location.objects.filter(openid=profile.openid, is_locked=True, status=LocationStatus.BLOCKED).count(),
                    1,
                )
                self.assertEqual(LocationLock.objects.filter(openid=profile.openid, is_delete=False).count(), 1)
                self.assertEqual(Supplier.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(Customer.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(Capital.objects.filter(openid=profile.openid, is_delete=False).count(), 2)
                self.assertEqual(GoodsUnit.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsClass.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsBrand.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsColor.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsShape.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsSpecs.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(GoodsOrigin.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(Goods.objects.filter(openid=profile.openid, is_delete=False).count(), 3)
                self.assertEqual(
                    TransportationFeeListModel.objects.filter(openid=profile.openid, is_delete=False).count(),
                    4,
                )
                self.assertEqual(Scanner.objects.filter(openid=profile.openid, is_delete=False).count(), 8)
                self.assertEqual(InventoryBalance.objects.filter(openid=profile.openid, is_delete=False).count(), 4)
                self.assertEqual(InventoryMovement.objects.filter(openid=profile.openid, is_delete=False).count(), 5)
                self.assertEqual(InventoryHold.objects.filter(openid=profile.openid, is_delete=False).count(), 1)

                media_path = Path(media_root) / profile.openid
                self.assertTrue((media_path / "win32").exists())
                self.assertTrue((media_path / "linux").exists())
                self.assertTrue((media_path / "darwin").exists())

                login_response = self.client.post(
                    self.login_url,
                    data=json.dumps({"name": DEFAULT_BOOTSTRAP_USERNAME, "password": DEFAULT_BOOTSTRAP_PASSWORD}),
                    content_type="application/json",
                )
                self.assertEqual(login_response.status_code, 200)
                self.assertEqual(login_response.json()["data"]["openid"], profile.openid)

    @override_settings(TEST_SYSTEM_ENABLED=True)
    def test_register_rejects_duplicate_username(self) -> None:
        with self.captureOnCommitCallbacks(execute=True):
            first = self.client.post(self.url, data=json.dumps({}), content_type="application/json")
        self.assertEqual(first.status_code, 201)

        response = self.client.post(self.url, data=json.dumps({}), content_type="application/json")
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["code"], "1022")

    @override_settings(TEST_SYSTEM_ENABLED=True)
    def test_register_rejects_password_mismatch(self) -> None:
        response = self.client.post(
            self.url,
            data=json.dumps({"name": "custom-seed", "password1": "one", "password2": "two"}),
            content_type="application/json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["code"], "1026")

    @override_settings(TEST_SYSTEM_ENABLED=False, DEBUG=False)
    def test_register_is_disabled_outside_explicit_dev_mode(self) -> None:
        response = self.client.post(self.url, data=json.dumps({}), content_type="application/json")
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["msg"], "Test-system bootstrap is disabled")
