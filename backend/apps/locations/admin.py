from django.contrib import admin

from apps.locations.models import Location, LocationLock, LocationType, Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "code", "name", "usage", "is_active")
    search_fields = ("code", "name", "warehouse__name", "organization__name")
    list_filter = ("usage", "is_active")


@admin.register(LocationType)
class LocationTypeAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "picking_enabled", "putaway_enabled", "is_active")
    search_fields = ("code", "name", "organization__name")
    list_filter = ("picking_enabled", "putaway_enabled", "allow_mixed_sku", "is_active")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("organization", "warehouse", "code", "zone", "location_type", "status", "is_locked", "is_active")
    search_fields = ("code", "name", "barcode", "warehouse__name", "organization__name")
    list_filter = ("status", "is_locked", "is_pick_face", "is_active")


@admin.register(LocationLock)
class LocationLockAdmin(admin.ModelAdmin):
    list_display = ("organization", "location", "reason", "locked_by", "is_active", "start_time")
    search_fields = ("reason", "location__code", "locked_by", "organization__name")
    list_filter = ("is_active",)

