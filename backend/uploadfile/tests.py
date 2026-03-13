from __future__ import annotations

from types import SimpleNamespace

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from catalog.goods.models import ListModel as Goods
from staff.models import ListModel as Staff

from .views import GoodlistfileViewSet


class UploadFileViewTests(TestCase):
    def setUp(self) -> None:
        self.factory = APIRequestFactory()
        self.user = get_user_model().objects.create_user(username="tester", password="password")
        self.staff = Staff.objects.create(
            staff_name="Operator",
            staff_type="Manager",
            check_code=1234,
            openid="test-openid",
        )
        self.auth = SimpleNamespace(openid=self.staff.openid)

    def test_goods_upload_supports_grouped_catalog_apps(self) -> None:
        file = SimpleUploadedFile(
            "goods.csv",
            (
                b"Goods Code,Goods Description,Goods Supplier,Goods Weight,Goods Wide,"
                b"Goods Depth,Goods Height,Unit Volume,Goods Unit,Goods Class,Goods Brand,"
                b"Goods Color,Goods Shape,Goods Specs,Goods Origin,Goods Cost,Goods Price\n"
                b"SKU001,Widget,Acme,1,2,3,4,24,EA,General,Acme,Blue,Box,Standard,USA,10,20\n"
            ),
            content_type="text/csv",
        )
        request = self.factory.post(
            "/api/upload/goodslistfile/",
            {"file": file},
            format="multipart",
            HTTP_OPERATOR=str(self.staff.id),
        )
        force_authenticate(request, user=self.user, token=self.auth)
        response = GoodlistfileViewSet.as_view()(request)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["detail"], "success")
        self.assertTrue(Goods.objects.filter(openid=self.staff.openid, goods_code="SKU001").exists())
