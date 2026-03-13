from django.test import TestCase

from .models import ListModel


class ListModelTests(TestCase):
    def test_str(self) -> None:
        obj = ListModel.objects.create(
            customer_name='Value',
            customer_city='City',
            customer_address='Address',
            customer_contact='555-0100',
            customer_manager='Alice',
            openid='openid',
            creator='tester',
        )
        self.assertIn('Value', str(obj))
