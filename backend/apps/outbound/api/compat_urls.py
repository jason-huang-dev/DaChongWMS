from django.urls import path

from .compat_views import CompatibilitySalesOrderListAPIView

urlpatterns = [
    path("outbound/sales-orders/", CompatibilitySalesOrderListAPIView.as_view(), name="compat-sales-order-list"),
]
