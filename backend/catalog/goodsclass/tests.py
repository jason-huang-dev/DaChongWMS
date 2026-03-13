from django.test import TestCase

from .models import ListModel


class ListModelTests(TestCase):
    def test_str(self) -> None:
        obj = ListModel.objects.create(
            goods_class='Value',
            openid='openid',
            creator='tester',
        )
        self.assertIn('Value', str(obj))
