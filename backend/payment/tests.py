from django.test import TestCase

from .models import TransportationFeeListModel


class TransportationFeeListModelTests(TestCase):
    def test_str(self) -> None:
        obj = TransportationFeeListModel.objects.create(
            send_city='Value',
            receiver_city='Dest',
            transportation_supplier='Carrier',
            openid='openid',
            creator='tester',
        )
        self.assertIn('Value', str(obj))
