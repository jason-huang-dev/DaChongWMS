from django.contrib import admin

from .models import ListModel


@admin.register(ListModel)
class ListModelAdmin(admin.ModelAdmin):
    list_display = ('customer_name', 'openid', 'is_delete')
    search_fields = ('customer_name', 'openid')
    list_filter = ('is_delete',)
