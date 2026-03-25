from django.urls import path

from apps.returns.api.views import (
    ReturnDispositionDetailAPIView,
    ReturnDispositionListCreateAPIView,
    ReturnOrderDetailAPIView,
    ReturnOrderListCreateAPIView,
    ReturnReceiptDetailAPIView,
    ReturnReceiptListCreateAPIView,
)


urlpatterns = [
    path(
        "organizations/<int:organization_id>/returns/return-orders/",
        ReturnOrderListCreateAPIView.as_view(),
        name="organization-return-order-list",
    ),
    path(
        "organizations/<int:organization_id>/returns/return-orders/<int:return_order_id>/",
        ReturnOrderDetailAPIView.as_view(),
        name="organization-return-order-detail",
    ),
    path(
        "organizations/<int:organization_id>/returns/receipts/",
        ReturnReceiptListCreateAPIView.as_view(),
        name="organization-return-receipt-list",
    ),
    path(
        "organizations/<int:organization_id>/returns/receipts/<int:return_receipt_id>/",
        ReturnReceiptDetailAPIView.as_view(),
        name="organization-return-receipt-detail",
    ),
    path(
        "organizations/<int:organization_id>/returns/dispositions/",
        ReturnDispositionListCreateAPIView.as_view(),
        name="organization-return-disposition-list",
    ),
    path(
        "organizations/<int:organization_id>/returns/dispositions/<int:return_disposition_id>/",
        ReturnDispositionDetailAPIView.as_view(),
        name="organization-return-disposition-detail",
    ),
]

