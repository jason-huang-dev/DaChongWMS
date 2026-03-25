from django.urls import path

from .compat_views import CompatibilityWarehouseListAPIView

urlpatterns = [
    path("warehouse/", CompatibilityWarehouseListAPIView.as_view(), name="compat-warehouse-list"),
]
