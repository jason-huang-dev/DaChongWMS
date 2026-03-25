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


class OrganizationStaffProfile(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="staff_profiles",
    )
    membership = models.OneToOneField(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="staff_profile",
        null=True,
        blank=True,
    )
    staff_name = models.CharField(max_length=255)
    staff_type = models.CharField(max_length=255)
    check_code = models.PositiveIntegerField(default=8888)
    is_lock = models.BooleanField(default=False)
    error_check_code_counter = models.PositiveIntegerField(default=0)
    default_warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.SET_NULL,
        related_name="organization_staff_profiles",
        null=True,
        blank=True,
    )
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("organization_id", "staff_name", "id")

    def __str__(self) -> str:
        return f"{self.organization} / {self.staff_name}"


class OrganizationInviteStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    REVOKED = "REVOKED", "Revoked"
    EXPIRED = "EXPIRED", "Expired"


class OrganizationInvite(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="invites",
    )
    created_by_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="issued_invites",
        null=True,
        blank=True,
    )
    accepted_membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="accepted_invites",
        null=True,
        blank=True,
    )
    email = models.EmailField()
    staff_name = models.CharField(max_length=255)
    staff_type = models.CharField(max_length=255)
    check_code = models.PositiveIntegerField(default=8888)
    default_warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.SET_NULL,
        related_name="organization_invites",
        null=True,
        blank=True,
    )
    is_company_admin = models.BooleanField(default=False)
    can_manage_users = models.BooleanField(default=False)
    status = models.CharField(
        max_length=20,
        choices=OrganizationInviteStatus.choices,
        default=OrganizationInviteStatus.PENDING,
    )
    invite_token = models.CharField(max_length=255, unique=True)
    invite_message = models.TextField(blank=True, default="")
    invited_by = models.CharField(max_length=255, blank=True, default="")
    expires_at = models.DateTimeField()
    accepted_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-create_time", "-id")

    def __str__(self) -> str:
        return f"{self.organization} / invite:{self.email}"


class OrganizationPasswordResetStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    COMPLETED = "COMPLETED", "Completed"
    REVOKED = "REVOKED", "Revoked"
    EXPIRED = "EXPIRED", "Expired"


class OrganizationPasswordReset(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="password_resets",
    )
    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.CASCADE,
        related_name="password_resets",
    )
    reset_token = models.CharField(max_length=255, unique=True)
    status = models.CharField(
        max_length=20,
        choices=OrganizationPasswordResetStatus.choices,
        default=OrganizationPasswordResetStatus.PENDING,
    )
    issued_by = models.CharField(max_length=255, blank=True, default="")
    expires_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True, default="")
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-create_time", "-id")

    def __str__(self) -> str:
        return f"{self.organization} / reset:{self.membership_id}"


class OrganizationAccessAuditAction(models.TextChoices):
    MEMBERSHIP_CREATED = "MEMBERSHIP_CREATED", "Membership created"
    MEMBERSHIP_UPDATED = "MEMBERSHIP_UPDATED", "Membership updated"
    MEMBERSHIP_SWITCHED = "MEMBERSHIP_SWITCHED", "Membership switched"
    STAFF_DIRECTORY_CREATED = "STAFF_DIRECTORY_CREATED", "Staff directory created"
    STAFF_DIRECTORY_UPDATED = "STAFF_DIRECTORY_UPDATED", "Staff directory updated"
    INVITE_CREATED = "INVITE_CREATED", "Invite created"
    INVITE_REVOKED = "INVITE_REVOKED", "Invite revoked"
    INVITE_ACCEPTED = "INVITE_ACCEPTED", "Invite accepted"
    PASSWORD_RESET_ISSUED = "PASSWORD_RESET_ISSUED", "Password reset issued"
    PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED", "Password reset completed"
    PASSWORD_RESET_REVOKED = "PASSWORD_RESET_REVOKED", "Password reset revoked"


class OrganizationAccessAuditEvent(models.Model):
    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="access_audit_events",
    )
    membership = models.ForeignKey(
        OrganizationMembership,
        on_delete=models.SET_NULL,
        related_name="access_audit_events",
        null=True,
        blank=True,
    )
    invite = models.ForeignKey(
        OrganizationInvite,
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    password_reset = models.ForeignKey(
        OrganizationPasswordReset,
        on_delete=models.SET_NULL,
        related_name="audit_events",
        null=True,
        blank=True,
    )
    action_type = models.CharField(max_length=64, choices=OrganizationAccessAuditAction.choices)
    actor_name = models.CharField(max_length=255, blank=True, default="")
    target_identifier = models.CharField(max_length=255, blank=True, default="")
    payload = models.JSONField(default=dict, blank=True)
    occurred_at = models.DateTimeField(auto_now_add=True)
    create_time = models.DateTimeField(auto_now_add=True)
    update_time = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ("-occurred_at", "-id")

    def __str__(self) -> str:
        return f"{self.organization} / {self.action_type}"
