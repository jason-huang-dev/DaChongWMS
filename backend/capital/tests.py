from django.test import TestCase

from .models import ListModel


class ListModelTests(TestCase):
    def test_str(self) -> None:
        obj = ListModel.objects.create(
            capital_name='Value',
            openid='openid',
            creator='tester',
        )
        self.assertIn('Value', str(obj))
