from django.test import TestCase

from .models import ListModel


class ListModelTests(TestCase):
    def test_str(self) -> None:
        obj = ListModel.objects.create(
            supplier_name='Value',
            supplier_city='City',
            supplier_address='Address',
            supplier_contact='123',
            supplier_manager='Manager',
            openid='openid',
            creator='tester',
        )
        self.assertIn('Value', str(obj))
