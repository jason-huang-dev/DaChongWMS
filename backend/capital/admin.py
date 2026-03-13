from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('capital_name', 'openid', 'is_delete')
    search_fields = ('capital_name', 'openid')
    list_filter = ('is_delete',)
