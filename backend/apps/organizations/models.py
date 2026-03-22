from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.conf import settings
from django.db import models

if TYPE_CHECKING:
    from apps.iam.models import AccessScope


class Organization(models.Model):
    name = models.CharField(max_length=255, unique=True)
    slug = models.SlugField(unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("name", "id")

    def clean(self) -> None:
        super().clean()
        self.name = self.name.strip()
        self.slug = self.slug.strip().lower()

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return self.name


class MembershipType(models.TextChoices):
    INTERNAL = "INTERNAL", "Internal"
    CLIENT = "CLIENT", "Client"


class OrganizationMembership(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="organization_memberships",
    )
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="memberships",
    )
    membership_type = models.CharField(
        max_length=20,
        choices=MembershipType.choices,
        default=MembershipType.INTERNAL,
    )
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ("organization_id", "user_id", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("user", "organization"),
                name="unique_user_organization_membership",
            ),
        ]

    def has_permission(self, permission_code: str, *, scope: AccessScope | None = None) -> bool:
        from apps.iam.permissions import membership_has_permission

        return membership_has_permission(self, permission_code, scope=scope)

    def __str__(self) -> str:
        return f"{self.user} @ {self.organization}"
