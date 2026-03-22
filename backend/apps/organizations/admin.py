from django.contrib import admin

from .models import Organization, OrganizationMembership


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
