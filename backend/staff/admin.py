"""Admin registrations for staff models."""

from django.contrib import admin

from .models import ListModel, TypeListModel


@admin.register(ListModel)
class StaffAdmin(admin.ModelAdmin):
    list_display = ("staff_name", "staff_type", "openid", "is_delete", "is_lock")
    search_fields = ("staff_name", "staff_type", "openid")
    list_filter = ("staff_type", "is_delete", "is_lock")


@admin.register(TypeListModel)
class StaffTypeAdmin(admin.ModelAdmin):
    list_display = ("staff_type", "creator")
    search_fields = ("staff_type", "creator")
