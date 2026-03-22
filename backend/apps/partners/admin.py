from django.contrib import admin

from .models import ClientAccountAccess, CustomerAccount


@admin.register(CustomerAccount)
class CustomerAccountAdmin(admin.ModelAdmin):
    list_display = ("organization", "code", "name", "billing_email", "is_active")
    search_fields = ("code", "name", "billing_email", "organization__name")
    list_filter = ("is_active",)


@admin.register(ClientAccountAccess)
class ClientAccountAccessAdmin(admin.ModelAdmin):
    list_display = ("membership", "customer_account", "is_active")
    search_fields = ("membership__user__email", "customer_account__code", "customer_account__name")
    list_filter = ("is_active",)
