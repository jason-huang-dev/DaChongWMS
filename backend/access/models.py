"""Company and membership models for browser-authenticated users."""

from __future__ import annotations

from django.conf import settings
from django.db import models
from django.db.models import Q


class TenantAuditModel(models.Model):
    creator = models.CharField(max_length=255, default="system", verbose_name="Created By")
    openid = models.CharField(max_length=255, verbose_name="Openid", db_index=True)
    is_delete = models.BooleanField(default=False, verbose_name="Delete Label")
    create_time = models.DateTimeField(auto_now_add=True, verbose_name="Create Time")
    update_time = models.DateTimeField(auto_now=True, verbose_name="Update Time")

    class Meta:
        abstract = True


class CompanyStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Active"
    INACTIVE = "INACTIVE", "Inactive"


class Company(TenantAuditModel):
    company_name = models.CharField(max_length=255, verbose_name="Company Name")
    company_code = models.CharField(max_length=64, verbose_name="Company Code")
    description = models.TextField(blank=True, default="", verbose_name="Description")
    status = models.CharField(max_length=16, choices=CompanyStatus.choices, default=CompanyStatus.ACTIVE, verbose_name="Status")
    default_warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="companies",
        blank=True,
        null=True,
        verbose_name="Default Warehouse",
    )

    class Meta:
        db_table = "access_company"
        verbose_name = "Company"
        verbose_name_plural = "Companies"
        ordering = ["company_name", "id"]
        constraints = [
            models.UniqueConstraint(fields=["openid"], condition=Q(is_delete=False), name="access_company_openid_uq"),
            models.UniqueConstraint(fields=["company_code"], condition=Q(is_delete=False), name="access_company_code_uq"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return self.company_name


class CompanyMembership(TenantAuditModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="memberships",
        verbose_name="Company",
    )
    auth_user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="company_memberships",
        verbose_name="Auth User",
    )
    profile = models.ForeignKey(
        "userprofile.Users",
        on_delete=models.PROTECT,
        related_name="company_memberships",
        verbose_name="Profile",
    )
    staff = models.ForeignKey(
        "staff.ListModel",
        on_delete=models.PROTECT,
        related_name="company_memberships",
        verbose_name="Staff",
    )
    default_warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="company_memberships",
        blank=True,
        null=True,
        verbose_name="Default Warehouse",
    )
    is_company_admin = models.BooleanField(default=False, verbose_name="Company Admin")
    can_manage_users = models.BooleanField(default=False, verbose_name="Can Manage Users")
    is_active = models.BooleanField(default=True, verbose_name="Is Active")
    invited_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Invited By")
    last_selected_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Selected At")

    class Meta:
        db_table = "access_company_membership"
        verbose_name = "Company Membership"
        verbose_name_plural = "Company Memberships"
        ordering = ["company_id", "auth_user_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["company", "auth_user"],
                condition=Q(is_delete=False),
                name="access_company_auth_user_uq",
            ),
            models.UniqueConstraint(
                fields=["profile"],
                condition=Q(is_delete=False),
                name="access_company_profile_uq",
            ),
            models.UniqueConstraint(
                fields=["staff"],
                condition=Q(is_delete=False),
                name="access_company_staff_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.company.company_name}:{self.auth_user}"


class CompanyInviteStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    ACCEPTED = "ACCEPTED", "Accepted"
    REVOKED = "REVOKED", "Revoked"
    EXPIRED = "EXPIRED", "Expired"


class CompanyPasswordResetStatus(models.TextChoices):
    PENDING = "PENDING", "Pending"
    COMPLETED = "COMPLETED", "Completed"
    REVOKED = "REVOKED", "Revoked"
    EXPIRED = "EXPIRED", "Expired"


class AccessAuditAction(models.TextChoices):
    MEMBERSHIP_PROVISIONED = "MEMBERSHIP_PROVISIONED", "Membership Provisioned"
    MEMBERSHIP_UPDATED = "MEMBERSHIP_UPDATED", "Membership Updated"
    MEMBERSHIP_SWITCHED = "MEMBERSHIP_SWITCHED", "Membership Switched"
    INVITE_CREATED = "INVITE_CREATED", "Invite Created"
    INVITE_REVOKED = "INVITE_REVOKED", "Invite Revoked"
    INVITE_ACCEPTED = "INVITE_ACCEPTED", "Invite Accepted"
    PASSWORD_RESET_ISSUED = "PASSWORD_RESET_ISSUED", "Password Reset Issued"
    PASSWORD_RESET_COMPLETED = "PASSWORD_RESET_COMPLETED", "Password Reset Completed"
    PASSWORD_RESET_REVOKED = "PASSWORD_RESET_REVOKED", "Password Reset Revoked"


class QueueViewDensity(models.TextChoices):
    COMPACT = "COMPACT", "Compact"
    COMFORTABLE = "COMFORTABLE", "Comfortable"


class WorkbenchTimeWindow(models.TextChoices):
    WEEK = "WEEK", "This Week"
    MONTH = "MONTH", "This Month"
    YEAR = "YEAR", "This Year"


class CompanyInvite(TenantAuditModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="invites",
        verbose_name="Company",
    )
    email = models.EmailField(verbose_name="Email")
    staff_name = models.CharField(max_length=80, verbose_name="Staff Name")
    staff_type = models.CharField(max_length=255, verbose_name="Staff Type")
    check_code = models.PositiveIntegerField(verbose_name="Check Code")
    default_warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="company_invites",
        blank=True,
        null=True,
        verbose_name="Default Warehouse",
    )
    is_company_admin = models.BooleanField(default=False, verbose_name="Company Admin")
    can_manage_users = models.BooleanField(default=False, verbose_name="Can Manage Users")
    status = models.CharField(
        max_length=16,
        choices=CompanyInviteStatus.choices,
        default=CompanyInviteStatus.PENDING,
        verbose_name="Status",
    )
    invite_token = models.CharField(max_length=128, verbose_name="Invite Token", db_index=True)
    invite_message = models.TextField(blank=True, default="", verbose_name="Invite Message")
    invited_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Invited By")
    expires_at = models.DateTimeField(verbose_name="Expires At")
    accepted_at = models.DateTimeField(blank=True, null=True, verbose_name="Accepted At")
    revoked_at = models.DateTimeField(blank=True, null=True, verbose_name="Revoked At")
    accepted_membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="accepted_invites",
        blank=True,
        null=True,
        verbose_name="Accepted Membership",
    )

    class Meta:
        db_table = "access_company_invite"
        verbose_name = "Company Invite"
        verbose_name_plural = "Company Invites"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["invite_token"], condition=Q(is_delete=False), name="access_company_invite_token_uq"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.company.company_name}:{self.email}"


class CompanyPasswordReset(TenantAuditModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="password_resets",
        verbose_name="Company",
    )
    membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="password_resets",
        verbose_name="Membership",
    )
    reset_token = models.CharField(max_length=128, verbose_name="Reset Token", db_index=True)
    status = models.CharField(
        max_length=16,
        choices=CompanyPasswordResetStatus.choices,
        default=CompanyPasswordResetStatus.PENDING,
        verbose_name="Status",
    )
    issued_by = models.CharField(max_length=255, blank=True, default="", verbose_name="Issued By")
    expires_at = models.DateTimeField(verbose_name="Expires At")
    completed_at = models.DateTimeField(blank=True, null=True, verbose_name="Completed At")
    revoked_at = models.DateTimeField(blank=True, null=True, verbose_name="Revoked At")
    notes = models.TextField(blank=True, default="", verbose_name="Notes")

    class Meta:
        db_table = "access_company_password_reset"
        verbose_name = "Company Password Reset"
        verbose_name_plural = "Company Password Resets"
        ordering = ["-create_time", "-id"]
        constraints = [
            models.UniqueConstraint(fields=["reset_token"], condition=Q(is_delete=False), name="access_password_reset_token_uq"),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.company.company_name}:{self.membership.auth_user.username}"


class AccessAuditEvent(TenantAuditModel):
    company = models.ForeignKey(
        Company,
        on_delete=models.PROTECT,
        related_name="audit_events",
        verbose_name="Company",
    )
    membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="audit_events",
        blank=True,
        null=True,
        verbose_name="Membership",
    )
    invite = models.ForeignKey(
        CompanyInvite,
        on_delete=models.PROTECT,
        related_name="audit_events",
        blank=True,
        null=True,
        verbose_name="Invite",
    )
    password_reset = models.ForeignKey(
        CompanyPasswordReset,
        on_delete=models.PROTECT,
        related_name="audit_events",
        blank=True,
        null=True,
        verbose_name="Password Reset",
    )
    action_type = models.CharField(max_length=64, choices=AccessAuditAction.choices, verbose_name="Action Type")
    actor_name = models.CharField(max_length=255, verbose_name="Actor Name")
    target_identifier = models.CharField(max_length=255, blank=True, default="", verbose_name="Target Identifier")
    payload = models.JSONField(default=dict, blank=True, verbose_name="Payload")
    occurred_at = models.DateTimeField(auto_now_add=True, verbose_name="Occurred At")

    class Meta:
        db_table = "access_audit_event"
        verbose_name = "Access Audit Event"
        verbose_name_plural = "Access Audit Events"
        ordering = ["-occurred_at", "-id"]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.company.company_name}:{self.action_type}:{self.id}"


class QueueViewPreference(TenantAuditModel):
    membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="queue_view_preferences",
        verbose_name="Membership",
    )
    warehouse = models.ForeignKey(
        "warehouse.Warehouse",
        on_delete=models.PROTECT,
        related_name="queue_view_preferences",
        blank=True,
        null=True,
        verbose_name="Warehouse",
    )
    route_key = models.CharField(max_length=128, verbose_name="Route Key")
    name = models.CharField(max_length=120, verbose_name="View Name")
    search_scope = models.CharField(max_length=64, blank=True, default="", verbose_name="Search Scope")
    status_bucket = models.CharField(max_length=64, blank=True, default="", verbose_name="Status Bucket")
    filter_payload = models.JSONField(default=dict, blank=True, verbose_name="Filter Payload")
    sort_payload = models.JSONField(default=dict, blank=True, verbose_name="Sort Payload")
    visible_columns = models.JSONField(default=list, blank=True, verbose_name="Visible Columns")
    page_size = models.PositiveIntegerField(default=25, verbose_name="Page Size")
    density = models.CharField(
        max_length=16,
        choices=QueueViewDensity.choices,
        default=QueueViewDensity.COMPACT,
        verbose_name="Density",
    )
    is_default = models.BooleanField(default=False, verbose_name="Is Default")
    last_used_at = models.DateTimeField(blank=True, null=True, verbose_name="Last Used At")

    class Meta:
        db_table = "access_queue_view_preference"
        verbose_name = "Queue View Preference"
        verbose_name_plural = "Queue View Preferences"
        ordering = ["route_key", "name", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "route_key", "name"],
                condition=Q(is_delete=False),
                name="access_queue_view_preference_name_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.membership.company.company_name}:{self.route_key}:{self.name}"


class WorkspaceTabPreference(TenantAuditModel):
    membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="workspace_tab_preferences",
        verbose_name="Membership",
    )
    route_key = models.CharField(max_length=128, verbose_name="Route Key")
    route_path = models.CharField(max_length=255, verbose_name="Route Path")
    title = models.CharField(max_length=120, verbose_name="Title")
    icon_key = models.CharField(max_length=64, blank=True, default="", verbose_name="Icon Key")
    position = models.PositiveIntegerField(default=0, verbose_name="Position")
    is_active = models.BooleanField(default=False, verbose_name="Is Active")
    is_pinned = models.BooleanField(default=False, verbose_name="Is Pinned")
    state_payload = models.JSONField(default=dict, blank=True, verbose_name="State Payload")
    context_payload = models.JSONField(default=dict, blank=True, verbose_name="Context Payload")
    last_opened_at = models.DateTimeField(auto_now=True, verbose_name="Last Opened At")

    class Meta:
        db_table = "access_workspace_tab_preference"
        verbose_name = "Workspace Tab Preference"
        verbose_name_plural = "Workspace Tab Preferences"
        ordering = ["position", "-last_opened_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "route_path"],
                condition=Q(is_delete=False),
                name="access_workspace_tab_preference_path_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.membership.company.company_name}:{self.title}"


class WorkbenchPreference(TenantAuditModel):
    membership = models.ForeignKey(
        CompanyMembership,
        on_delete=models.PROTECT,
        related_name="workbench_preferences",
        verbose_name="Membership",
    )
    page_key = models.CharField(max_length=128, verbose_name="Page Key")
    time_window = models.CharField(
        max_length=16,
        choices=WorkbenchTimeWindow.choices,
        default=WorkbenchTimeWindow.WEEK,
        verbose_name="Time Window",
    )
    visible_widget_keys = models.JSONField(default=list, blank=True, verbose_name="Visible Widget Keys")
    right_rail_widget_keys = models.JSONField(default=list, blank=True, verbose_name="Right Rail Widget Keys")
    layout_payload = models.JSONField(default=dict, blank=True, verbose_name="Layout Payload")

    class Meta:
        db_table = "access_workbench_preference"
        verbose_name = "Workbench Preference"
        verbose_name_plural = "Workbench Preferences"
        ordering = ["page_key", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["membership", "page_key"],
                condition=Q(is_delete=False),
                name="access_workbench_preference_page_uq",
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover
        return f"{self.membership.company.company_name}:{self.page_key}"
