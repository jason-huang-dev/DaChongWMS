from __future__ import annotations

from typing import Any

from django.conf import settings
from django.db import models


class UserSetting(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="settings",
    )
    membership = models.ForeignKey(
        "organizations.OrganizationMembership",
        on_delete=models.CASCADE,
        related_name="user_settings",
        null=True,
        blank=True,
    )
    category = models.CharField(max_length=64)
    setting_key = models.CharField(max_length=64)
    payload = models.JSONField(default=dict, blank=True)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("user_id", "membership_id", "category", "setting_key", "id")
        constraints = [
            models.UniqueConstraint(
                fields=("user", "membership", "category", "setting_key"),
                name="unique_user_setting_scope",
            ),
        ]

    def save(self, *args: Any, **kwargs: Any) -> None:
        if not isinstance(self.payload, dict):
            self.payload = {}
        self.category = self.category.strip()
        self.setting_key = self.setting_key.strip()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        scope = f"membership:{self.membership_id}" if self.membership_id else "global"
        return f"{self.user_id} / {scope} / {self.category}:{self.setting_key}"
