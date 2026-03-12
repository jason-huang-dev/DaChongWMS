from __future__ import annotations

from django.contrib import admin

from .models import Warehouse


@admin.register(Warehouse)
class WarehouseAdmin(admin.ModelAdmin):
    list_display = (
        "warehouse_name",
        "warehouse_city",
        "warehouse_contact",
        "openid",
        "is_delete",
    )
    list_filter = ("is_delete", "warehouse_city")
    search_fields = ("warehouse_name", "warehouse_city", "warehouse_manager", "openid")
