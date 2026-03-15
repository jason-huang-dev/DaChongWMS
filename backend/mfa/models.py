"""Models for TOTP enrollment, recovery codes, and login challenges."""

from __future__ import annotations

import uuid

from django.conf import settings
from django.db import models


class MFAEnrollment(models.Model):
    class Method(models.TextChoices):
        TOTP = "TOTP", "Authenticator app"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mfa_enrollments")
    openid = models.CharField(max_length=100, db_index=True, verbose_name="OpenID")
    label = models.CharField(max_length=255, default="Authenticator app", verbose_name="Label")
    method = models.CharField(max_length=32, choices=Method.choices, default=Method.TOTP, verbose_name="Method")
    encrypted_secret = models.TextField(verbose_name="Encrypted Secret")
    is_primary = models.BooleanField(default=True, verbose_name="Primary Enrollment")
    is_verified = models.BooleanField(default=False, verbose_name="Verified")
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name="Verified At")
    last_used_at = models.DateTimeField(null=True, blank=True, verbose_name="Last Used At")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    creator = models.CharField(max_length=255, verbose_name="Creator")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = "mfa_enrollment"
        verbose_name = "MFA Enrollment"
        verbose_name_plural = "MFA Enrollments"
        ordering = ["-is_primary", "-create_time"]

    def __str__(self) -> str:  # pragma: no cover - debug helper
        return f"{self.user}::{self.method}::{self.label}"


class MFARecoveryCode(models.Model):
    enrollment = models.ForeignKey(MFAEnrollment, on_delete=models.CASCADE, related_name="recovery_codes")
    openid = models.CharField(max_length=100, db_index=True, verbose_name="OpenID")
    code_hash = models.CharField(max_length=255, verbose_name="Code Hash")
    code_hint = models.CharField(max_length=16, verbose_name="Code Hint")
    used_at = models.DateTimeField(null=True, blank=True, verbose_name="Used At")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    creator = models.CharField(max_length=255, verbose_name="Creator")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = "mfa_recovery_code"
        verbose_name = "MFA Recovery Code"
        verbose_name_plural = "MFA Recovery Codes"
        ordering = ["id"]

    def __str__(self) -> str:  # pragma: no cover - debug helper
        return f"{self.enrollment_id}::{self.code_hint}"


class MFAChallenge(models.Model):
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        VERIFIED = "VERIFIED", "Verified"
        USED = "USED", "Used"
        EXPIRED = "EXPIRED", "Expired"

    class Method(models.TextChoices):
        TOTP = "TOTP", "Authenticator app"
        RECOVERY_CODE = "RECOVERY_CODE", "Recovery code"

    challenge_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="mfa_challenges")
    openid = models.CharField(max_length=100, db_index=True, verbose_name="OpenID")
    username = models.CharField(max_length=150, verbose_name="User Name")
    operator_id = models.PositiveIntegerField(verbose_name="Operator ID")
    operator_name = models.CharField(max_length=255, verbose_name="Operator Name")
    status = models.CharField(max_length=32, choices=Status.choices, default=Status.PENDING, verbose_name="Status")
    verified_method = models.CharField(max_length=32, choices=Method.choices, blank=True, default="", verbose_name="Verified Method")
    expires_at = models.DateTimeField(verbose_name="Expires At")
    verified_at = models.DateTimeField(null=True, blank=True, verbose_name="Verified At")
    consumed_at = models.DateTimeField(null=True, blank=True, verbose_name="Consumed At")
    ip = models.CharField(max_length=100, blank=True, default="", verbose_name="Client IP")
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    creator = models.CharField(max_length=255, verbose_name="Creator")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        db_table = "mfa_challenge"
        verbose_name = "MFA Challenge"
        verbose_name_plural = "MFA Challenges"
        ordering = ["-create_time"]

    def __str__(self) -> str:  # pragma: no cover - debug helper
        return f"{self.username}::{self.challenge_id}::{self.status}"
