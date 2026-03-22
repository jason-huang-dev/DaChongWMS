from __future__ import annotations

from django.db.models.signals import post_migrate
from django.dispatch import receiver

from .services.bootstrap import sync_system_roles


@receiver(post_migrate)
def sync_iam_defaults(**_kwargs: object) -> None:
    sync_system_roles()
