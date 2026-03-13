from django.test import TestCase

from .models import ListModel


class GoodsModelTest(TestCase):
    def test_str_representation(self) -> None:
        goods = ListModel.objects.create(
            goods_code="SKU001",
            goods_desc="Sample",
            goods_supplier="Supplier",
            creator="tester",
            bar_code="code",
            openid="openid",
        )
        self.assertIn("SKU001", str(goods))
