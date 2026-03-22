from __future__ import annotations

from django.core.management.base import BaseCommand

from apps.iam.services.bootstrap import sync_system_roles


class Command(BaseCommand):
    help = "Sync global IAM roles and permissions."

    def handle(self, *args: object, **kwargs: object) -> None:
        roles = sync_system_roles()
        self.stdout.write(self.style.SUCCESS(f"Synced {len(roles)} IAM system roles."))
