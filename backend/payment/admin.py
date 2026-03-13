from django.contrib import admin

from .models import TransportationFeeListModel


@admin.register(TransportationFeeListModel)
class TransportationFeeListModelAdmin(admin.ModelAdmin):
    list_display = ('send_city', 'openid', 'is_delete')
    search_fields = ('send_city', 'openid')
    list_filter = ('is_delete',)
