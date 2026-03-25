from django.contrib import admin

from .models import (
    Organization,
    OrganizationAccessAuditEvent,
    OrganizationInvite,
    OrganizationMembership,
    OrganizationPasswordReset,
    OrganizationStaffProfile,
)


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active")
    search_fields = ("name", "slug")
    list_filter = ("is_active",)


@admin.register(OrganizationMembership)
class OrganizationMembershipAdmin(admin.ModelAdmin):
    list_display = ("user", "organization", "membership_type", "is_active")
    search_fields = ("user__email", "organization__name")
    list_filter = ("membership_type", "is_active")


@admin.register(OrganizationStaffProfile)
class OrganizationStaffProfileAdmin(admin.ModelAdmin):
    list_display = ("staff_name", "staff_type", "organization", "membership", "default_warehouse", "is_lock")
    search_fields = ("staff_name", "staff_type", "organization__name", "membership__user__email")
    list_filter = ("staff_type", "is_lock")


@admin.register(OrganizationInvite)
class OrganizationInviteAdmin(admin.ModelAdmin):
    list_display = ("email", "organization", "staff_type", "status", "expires_at")
    search_fields = ("email", "staff_name", "organization__name", "invite_token")
    list_filter = ("status", "staff_type")


@admin.register(OrganizationPasswordReset)
class OrganizationPasswordResetAdmin(admin.ModelAdmin):
    list_display = ("membership", "organization", "status", "expires_at")
    search_fields = ("membership__user__email", "membership__organization__name", "reset_token")
    list_filter = ("status",)


@admin.register(OrganizationAccessAuditEvent)
class OrganizationAccessAuditEventAdmin(admin.ModelAdmin):
    list_display = ("organization", "action_type", "actor_name", "target_identifier", "occurred_at")
    search_fields = ("organization__name", "action_type", "actor_name", "target_identifier")
    list_filter = ("action_type",)
