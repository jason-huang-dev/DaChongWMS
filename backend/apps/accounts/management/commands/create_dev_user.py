from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.accounts.services.user_service import get_or_create_user_by_email


class Command(BaseCommand):
    help = "Create or update a default dev user"

    def handle(self, *args: object, **kwargs: object) -> None:
        user, _created = get_or_create_user_by_email(
            email="dev@example.com",
            full_name="Dev User",
            password="ChangeMe123!",
        )
        update_fields: list[str] = []
        if not user.is_staff:
            user.is_staff = True
            update_fields.append("is_staff")
        if not user.is_active:
            user.is_active = True
            update_fields.append("is_active")
        if update_fields:
            user.save(update_fields=update_fields)
        self.stdout.write(self.style.SUCCESS(f"Dev user ready: {user.email}"))
