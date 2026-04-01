from django.urls import path

from .compat_views import CompatibilityPurchaseOrderListAPIView, CompatibilityPutawayTaskListAPIView

urlpatterns = [
    path("inbound/purchase-orders/", CompatibilityPurchaseOrderListAPIView.as_view(), name="compat-purchase-order-list"),
    path("inbound/putaway-tasks/", CompatibilityPutawayTaskListAPIView.as_view(), name="compat-putaway-task-list"),
]
