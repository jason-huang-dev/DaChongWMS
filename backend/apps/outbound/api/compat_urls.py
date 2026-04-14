from django.urls import path

from .compat_views import CompatibilityPickTaskListAPIView, CompatibilitySalesOrderListAPIView

urlpatterns = [
    path("outbound/pick-tasks/", CompatibilityPickTaskListAPIView.as_view(), name="compat-pick-task-list"),
    path("outbound/sales-orders/", CompatibilitySalesOrderListAPIView.as_view(), name="compat-sales-order-list"),
]
