from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class GoodsAdmin(admin.ModelAdmin):
    list_display = ("goods_code", "goods_desc", "goods_supplier", "goods_unit", "is_delete")
    search_fields = ("goods_code", "goods_desc", "goods_supplier")
    list_filter = ("goods_unit", "goods_class", "is_delete")
