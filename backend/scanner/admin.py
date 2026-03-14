from django.contrib import admin

from .models import BarcodeAlias, GoodsScanRule, LicensePlate, ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('mode', 'openid', 'is_delete')
    search_fields = ('mode', 'openid')
    list_filter = ('is_delete',)


@admin.register(BarcodeAlias)
class BarcodeAliasAdmin(admin.ModelAdmin):
    list_display = ("target_type", "alias_code", "goods", "location", "openid", "is_delete")
    search_fields = ("alias_code", "openid")
    list_filter = ("target_type", "is_delete")


@admin.register(GoodsScanRule)
class GoodsScanRuleAdmin(admin.ModelAdmin):
    list_display = ("goods", "requires_lot", "requires_serial", "openid")
    search_fields = ("goods__goods_code", "openid")
    list_filter = ("requires_lot", "requires_serial")


@admin.register(LicensePlate)
class LicensePlateAdmin(admin.ModelAdmin):
    list_display = ("lpn_code", "warehouse", "goods", "current_location", "quantity", "status", "openid")
    search_fields = ("lpn_code", "reference_code", "openid")
    list_filter = ("status", "warehouse")
