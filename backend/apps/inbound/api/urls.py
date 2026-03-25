from django.urls import path

from apps.inbound.api.views import (
    AdvanceShipmentNoticeDetailAPIView,
    AdvanceShipmentNoticeListCreateAPIView,
    PurchaseOrderDetailAPIView,
    PurchaseOrderListCreateAPIView,
    PutawayTaskCompleteAPIView,
    PutawayTaskDetailAPIView,
    PutawayTaskListAPIView,
    ReceiptDetailAPIView,
    ReceiptListCreateAPIView,
)


urlpatterns = [
    path(
        "organizations/<int:organization_id>/inbound/purchase-orders/",
        PurchaseOrderListCreateAPIView.as_view(),
        name="organization-purchase-order-list",
    ),
    path(
        "organizations/<int:organization_id>/inbound/purchase-orders/<int:purchase_order_id>/",
        PurchaseOrderDetailAPIView.as_view(),
        name="organization-purchase-order-detail",
    ),
    path(
        "organizations/<int:organization_id>/inbound/asns/",
        AdvanceShipmentNoticeListCreateAPIView.as_view(),
        name="organization-asn-list",
    ),
    path(
        "organizations/<int:organization_id>/inbound/asns/<int:asn_id>/",
        AdvanceShipmentNoticeDetailAPIView.as_view(),
        name="organization-asn-detail",
    ),
    path(
        "organizations/<int:organization_id>/inbound/receipts/",
        ReceiptListCreateAPIView.as_view(),
        name="organization-receipt-list",
    ),
    path(
        "organizations/<int:organization_id>/inbound/receipts/<int:receipt_id>/",
        ReceiptDetailAPIView.as_view(),
        name="organization-receipt-detail",
    ),
    path(
        "organizations/<int:organization_id>/inbound/putaway-tasks/",
        PutawayTaskListAPIView.as_view(),
        name="organization-putaway-task-list",
    ),
    path(
        "organizations/<int:organization_id>/inbound/putaway-tasks/<int:putaway_task_id>/",
        PutawayTaskDetailAPIView.as_view(),
        name="organization-putaway-task-detail",
    ),
    path(
        "organizations/<int:organization_id>/inbound/putaway-tasks/<int:putaway_task_id>/complete/",
        PutawayTaskCompleteAPIView.as_view(),
        name="organization-putaway-task-complete",
    ),
]

