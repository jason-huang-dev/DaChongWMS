from django.test import TestCase

from .models import ListModel


class ListModelTests(TestCase):
    def test_str(self) -> None:
        obj = ListModel.objects.create(
            mode='Value',
            code='CODE123',
            bar_code='BAR123',
            openid='openid',
        )
        self.assertIn('Value', str(obj))
