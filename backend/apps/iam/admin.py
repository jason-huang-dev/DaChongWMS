from django.contrib import admin

from .models import (
    AccessGroup,
    AccessGroupPermission,
    AccessScope,
    GroupAssignment,
    PermissionOverride,
    Role,
    RoleAssignment,
    RolePermission,
)


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("code", "name", "organization", "membership_type", "is_system", "is_active")
    search_fields = ("code", "name", "organization__name")
    list_filter = ("membership_type", "is_system", "is_active")


admin.site.register(RolePermission)
admin.site.register(RoleAssignment)
admin.site.register(AccessScope)
admin.site.register(AccessGroup)
admin.site.register(AccessGroupPermission)
admin.site.register(GroupAssignment)
admin.site.register(PermissionOverride)
