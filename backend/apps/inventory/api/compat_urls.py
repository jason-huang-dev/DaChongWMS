from django.urls import path

from .compat_views import CompatibilityInventoryBalanceListAPIView

urlpatterns = [
    path("inventory/balances/", CompatibilityInventoryBalanceListAPIView.as_view(), name="compat-inventory-balance-list"),
]
