from django.contrib import admin

from .models import Users


@admin.register(Users)
class UsersAdmin(admin.ModelAdmin):
    list_display = ("name", "openid", "vip", "is_delete", "developer")
    search_fields = ("name", "openid", "appid")
    list_filter = ("vip", "developer", "is_delete")
