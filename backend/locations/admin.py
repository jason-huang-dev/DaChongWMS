from __future__ import annotations

from django.contrib import admin

from .models import Location, LocationLock, LocationType, Zone


@admin.register(Zone)
class ZoneAdmin(admin.ModelAdmin):
    list_display = ("zone_code", "zone_name", "warehouse", "usage", "is_active", "openid", "is_delete")
    list_filter = ("usage", "is_active", "is_delete")
    search_fields = ("zone_code", "zone_name", "warehouse__warehouse_name", "openid")


@admin.register(LocationType)
class LocationTypeAdmin(admin.ModelAdmin):
    list_display = ("type_code", "type_name", "picking_enabled", "putaway_enabled", "allow_mixed_sku", "openid")
    list_filter = ("picking_enabled", "putaway_enabled", "allow_mixed_sku", "is_delete")
    search_fields = ("type_code", "type_name", "openid")


@admin.register(Location)
class LocationAdmin(admin.ModelAdmin):
    list_display = ("location_code", "warehouse", "zone", "location_type", "status", "is_pick_face", "is_locked", "openid")
    list_filter = ("status", "is_pick_face", "is_locked", "is_delete")
    search_fields = ("location_code", "location_name", "barcode", "openid")


@admin.register(LocationLock)
class LocationLockAdmin(admin.ModelAdmin):
    list_display = ("location", "reason", "locked_by", "is_active", "openid", "start_time", "end_time")
    list_filter = ("is_active", "is_delete")
    search_fields = ("location__location_code", "reason", "locked_by", "openid")
