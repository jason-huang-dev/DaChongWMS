from django.urls import path

from apps.outbound.api.views import (
    PickTaskCompleteAPIView,
    PickTaskDetailAPIView,
    PickTaskListAPIView,
    SalesOrderAllocateAPIView,
    SalesOrderDetailAPIView,
    SalesOrderListCreateAPIView,
    SalesOrderShipAPIView,
    ShipmentDetailAPIView,
    ShipmentListAPIView,
)


urlpatterns = [
    path(
        "organizations/<int:organization_id>/outbound/sales-orders/",
        SalesOrderListCreateAPIView.as_view(),
        name="organization-sales-order-list",
    ),
    path(
        "organizations/<int:organization_id>/outbound/sales-orders/<int:sales_order_id>/",
        SalesOrderDetailAPIView.as_view(),
        name="organization-sales-order-detail",
    ),
    path(
        "organizations/<int:organization_id>/outbound/sales-orders/<int:sales_order_id>/allocate/",
        SalesOrderAllocateAPIView.as_view(),
        name="organization-sales-order-allocate",
    ),
    path(
        "organizations/<int:organization_id>/outbound/sales-orders/<int:sales_order_id>/ship/",
        SalesOrderShipAPIView.as_view(),
        name="organization-sales-order-ship",
    ),
    path(
        "organizations/<int:organization_id>/outbound/pick-tasks/",
        PickTaskListAPIView.as_view(),
        name="organization-pick-task-list",
    ),
    path(
        "organizations/<int:organization_id>/outbound/pick-tasks/<int:pick_task_id>/",
        PickTaskDetailAPIView.as_view(),
        name="organization-pick-task-detail",
    ),
    path(
        "organizations/<int:organization_id>/outbound/pick-tasks/<int:pick_task_id>/complete/",
        PickTaskCompleteAPIView.as_view(),
        name="organization-pick-task-complete",
    ),
    path(
        "organizations/<int:organization_id>/outbound/shipments/",
        ShipmentListAPIView.as_view(),
        name="organization-shipment-list",
    ),
    path(
        "organizations/<int:organization_id>/outbound/shipments/<int:shipment_id>/",
        ShipmentDetailAPIView.as_view(),
        name="organization-shipment-detail",
    ),
]

