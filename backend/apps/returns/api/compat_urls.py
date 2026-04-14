from django.urls import path

from .compat_views import CompatibilityReturnOrderDetailAPIView, CompatibilityReturnOrderListAPIView

urlpatterns = [
    path("returns/return-orders/", CompatibilityReturnOrderListAPIView.as_view(), name="compat-return-order-list"),
    path(
        "returns/return-orders/<int:return_order_id>/",
        CompatibilityReturnOrderDetailAPIView.as_view(),
        name="compat-return-order-detail",
    ),
]
