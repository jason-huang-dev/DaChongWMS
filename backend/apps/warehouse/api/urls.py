from django.urls import path

from .views import (
    OrganizationWarehouseDetailAPIView,
    OrganizationWarehouseListCreateAPIView,
)

urlpatterns = [
    path(
        "organizations/<int:organization_id>/warehouses/",
        OrganizationWarehouseListCreateAPIView.as_view(),
        name="organization-warehouse-list",
    ),
    path(
        "organizations/<int:organization_id>/warehouses/<int:warehouse_id>/",
        OrganizationWarehouseDetailAPIView.as_view(),
        name="organization-warehouse-detail",
    ),
]
