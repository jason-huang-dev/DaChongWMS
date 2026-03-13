from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('mode', 'openid', 'is_delete')
    search_fields = ('mode', 'openid')
    list_filter = ('is_delete',)
