from django.urls import path

from .compat_views import (
    CompatibilityAdvanceShipmentNoticeListAPIView,
    CompatibilityPurchaseOrderListAPIView,
    CompatibilityPutawayTaskListAPIView,
)

urlpatterns = [
    path(
        "inbound/advance-shipment-notices/",
        CompatibilityAdvanceShipmentNoticeListAPIView.as_view(),
        name="compat-advance-shipment-notice-list",
    ),
    path("inbound/purchase-orders/", CompatibilityPurchaseOrderListAPIView.as_view(), name="compat-purchase-order-list"),
    path("inbound/putaway-tasks/", CompatibilityPutawayTaskListAPIView.as_view(), name="compat-putaway-task-list"),
]
