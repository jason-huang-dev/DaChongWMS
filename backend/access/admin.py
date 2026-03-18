from django.contrib import admin

from .models import (
    AccessAuditEvent,
    Company,
    CompanyInvite,
    CompanyMembership,
    CompanyPasswordReset,
    QueueViewPreference,
    WorkspaceTabPreference,
    WorkbenchPreference,
)


@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ("company_name", "company_code", "openid", "status", "default_warehouse")
    search_fields = ("company_name", "company_code", "openid")
    list_filter = ("status",)


@admin.register(CompanyMembership)
class CompanyMembershipAdmin(admin.ModelAdmin):
    list_display = (
        "company",
        "auth_user",
        "staff",
        "is_company_admin",
        "can_manage_users",
        "is_active",
        "last_selected_at",
    )
    search_fields = (
        "company__company_name",
        "company__openid",
        "auth_user__username",
        "staff__staff_name",
        "profile__openid",
    )
    list_filter = ("is_company_admin", "can_manage_users", "is_active")


@admin.register(CompanyInvite)
class CompanyInviteAdmin(admin.ModelAdmin):
    list_display = ("company", "email", "staff_type", "status", "expires_at", "invited_by")
    search_fields = ("company__company_name", "email", "staff_name", "invite_token")
    list_filter = ("status", "staff_type", "is_company_admin", "can_manage_users")


@admin.register(CompanyPasswordReset)
class CompanyPasswordResetAdmin(admin.ModelAdmin):
    list_display = ("company", "membership", "status", "issued_by", "expires_at", "completed_at")
    search_fields = ("company__company_name", "membership__auth_user__username", "reset_token")
    list_filter = ("status",)


@admin.register(AccessAuditEvent)
class AccessAuditEventAdmin(admin.ModelAdmin):
    list_display = ("company", "action_type", "actor_name", "target_identifier", "occurred_at")
    search_fields = ("company__company_name", "actor_name", "target_identifier")
    list_filter = ("action_type",)


@admin.register(QueueViewPreference)
class QueueViewPreferenceAdmin(admin.ModelAdmin):
    list_display = ("membership", "route_key", "name", "warehouse", "status_bucket", "density", "is_default")
    search_fields = ("membership__company__company_name", "route_key", "name")
    list_filter = ("density", "is_default", "route_key")


@admin.register(WorkspaceTabPreference)
class WorkspaceTabPreferenceAdmin(admin.ModelAdmin):
    list_display = ("membership", "title", "route_key", "route_path", "position", "is_active", "is_pinned")
    search_fields = ("membership__company__company_name", "title", "route_key", "route_path")
    list_filter = ("is_active", "is_pinned")


@admin.register(WorkbenchPreference)
class WorkbenchPreferenceAdmin(admin.ModelAdmin):
    list_display = ("membership", "page_key", "time_window", "update_time")
    search_fields = ("membership__company__company_name", "page_key")
    list_filter = ("time_window",)
