"""Staff directory models ported from the GreaterWMS project.

The ``ListModel`` table tracks warehouse users that can log into handheld or
browser clients, while ``TypeListModel`` stores seed data describing the
general role for each staff member (manager, inbound, outbound, etc.).
"""

from __future__ import annotations

from django.db import models


class ListModel(models.Model):
    staff_name = models.CharField(max_length=255, verbose_name="Staff Name")
    staff_type = models.CharField(max_length=255, verbose_name="Staff Type")
    check_code = models.IntegerField(default=8888, verbose_name="Check Code")
    openid = models.CharField(max_length=255, verbose_name="OpenID")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")
    error_check_code_counter = models.IntegerField(
        default=0,
        verbose_name="Check Code Error Counter",
    )
    is_lock = models.BooleanField(default=False, verbose_name="Is Locked")

    class Meta:
        db_table = "staff"
        verbose_name = "Staff"
        verbose_name_plural = "Staff"
        ordering = ["staff_name"]

    def __str__(self) -> str:  # pragma: no cover - debug helper
        return f"{self.staff_name} ({self.staff_type})"


class TypeListModel(models.Model):
    staff_type = models.CharField(max_length=255, verbose_name="Staff Type")
    openid = models.CharField(max_length=255, verbose_name="OpenID")
    creator = models.CharField(max_length=255, verbose_name="Creator")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = "stafftype"
        verbose_name = "Staff Type"
        verbose_name_plural = "Staff Types"
        ordering = ["staff_type"]

    def __str__(self) -> str:  # pragma: no cover - debug helper
        return self.staff_type
