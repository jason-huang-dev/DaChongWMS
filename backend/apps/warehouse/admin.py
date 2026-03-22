from django.contrib import admin

from .models import Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "is_active")
    search_fields = ("code", "name", "organization__name")
    list_filter = ("is_active",)
