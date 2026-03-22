from __future__ import annotations

from typing import Any

from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class UserManager(BaseUserManager):
    use_in_migrations = True

    def _create_user(self, email: str, password: str | None, **extra_fields: Any) -> User:
        if not email:
            raise ValueError("Email must be set.")

        normalized_email = self.normalize_email(email).strip().lower()
        user = self.model(email=normalized_email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(self, email: str, password: str | None = None, **extra_fields: Any) -> User:
        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        return self._create_user(email, password, **extra_fields)

    def create_superuser(self, email: str, password: str | None = None, **extra_fields: Any) -> User:
        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)

        if extra_fields.get("is_staff") is not True:
            raise ValueError("Superuser must have is_staff=True.")
        if extra_fields.get("is_superuser") is not True:
            raise ValueError("Superuser must have is_superuser=True.")

        return self._create_user(email, password, **extra_fields)


class User(AbstractUser):
    username = models.CharField(max_length=150, unique=True, blank=True, editable=False)
    email = models.EmailField(unique=True, db_index=True)
    full_name = models.CharField(max_length=255, blank=True, default="")
    is_active = models.BooleanField(default=True)

    USERNAME_FIELD = "email"
    REQUIRED_FIELDS: list[str] = []

    objects = UserManager()

    class Meta:
        ordering = ("email", "id")

    def clean(self) -> None:
        super().clean()
        self.email = type(self).objects.normalize_email(self.email).strip().lower()
        if not self.username:
            self.username = self.email

    def save(self, *args: Any, **kwargs: Any) -> None:
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_name(self) -> str:
        return self.full_name or self.email

    def __str__(self) -> str:
        return self.email
