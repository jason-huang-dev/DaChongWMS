from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('goods_color', 'openid', 'is_delete')
    search_fields = ('goods_color', 'openid')
    list_filter = ('is_delete',)
