from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('goods_origin', 'openid', 'is_delete')
    search_fields = ('goods_origin', 'openid')
    list_filter = ('is_delete',)
