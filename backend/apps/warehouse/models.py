from __future__ import annotations

from typing import Any

from django.core.exceptions import ValidationError
from django.db import models

from apps.organizations.models import Organization


class Warehouse(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="warehouses",
    )
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=50)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "name", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("organization", "code"),
                name="unique_warehouse_code_per_organization",
            ),
        ]

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        normalized_code = self.code.strip().upper()
        if not normalized_code:
            raise ValidationError({"code": "Warehouse code cannot be blank."})
        self.code = normalized_code

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.organization} / {self.code}"
