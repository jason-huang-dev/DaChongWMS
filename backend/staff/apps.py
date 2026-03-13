"""Application configuration for the staff app."""

from __future__ import annotations

from typing import Sequence

from django.apps import AppConfig
from django.db.models.signals import post_migrate


class StaffConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "staff"
    verbose_name = "Staff"

    def ready(self) -> None:  # pragma: no cover - wiring only
        post_migrate.connect(seed_staff_types, sender=self)


def seed_staff_types(**_: object) -> None:
    """Ensure the canonical staff role rows exist after every migration."""

    from .models import TypeListModel

    seeds: Sequence[tuple[int, str]] = (
        (1, "Manager"),
        (2, "Supplier"),
        (3, "Customer"),
        (4, "Supervisor"),
        (5, "Inbound"),
        (6, "Outbound"),
        (7, "StockControl"),
    )
    existing = TypeListModel.objects.filter(openid__iexact="init_data")
    if existing.count() == len(seeds):
        return
    existing.delete()
    TypeListModel.objects.bulk_create(
        [
            TypeListModel(id=pk, openid="init_data", staff_type=label, creator="DaChongWMS")
            for pk, label in seeds
        ],
        batch_size=50,
    )
