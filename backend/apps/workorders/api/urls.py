from django.urls import path

from .views import (
    OrganizationWorkOrderDetailAPIView,
    OrganizationWorkOrderListCreateAPIView,
    OrganizationWorkOrderTypeDetailAPIView,
    OrganizationWorkOrderTypeListCreateAPIView,
)

urlpatterns = [
    path(
        "organizations/<int:organization_id>/work-order-types/",
        OrganizationWorkOrderTypeListCreateAPIView.as_view(),
        name="organization-work-order-type-list",
    ),
    path(
        "organizations/<int:organization_id>/work-order-types/<int:work_order_type_id>/",
        OrganizationWorkOrderTypeDetailAPIView.as_view(),
        name="organization-work-order-type-detail",
    ),
    path(
        "organizations/<int:organization_id>/work-orders/",
        OrganizationWorkOrderListCreateAPIView.as_view(),
        name="organization-work-order-list",
    ),
    path(
        "organizations/<int:organization_id>/work-orders/<int:work_order_id>/",
        OrganizationWorkOrderDetailAPIView.as_view(),
        name="organization-work-order-detail",
    ),
]

