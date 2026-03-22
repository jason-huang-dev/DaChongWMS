from __future__ import annotations

from django.test import TestCase

from apps.accounts.models import User


class UserModelTests(TestCase):
    def test_email_is_normalized_on_save(self) -> None:
        user = User.objects.create_user(email="UPPER@Example.COM", password="secret")
        self.assertEqual(user.email, "upper@example.com")
        self.assertEqual(user.username, user.email)
