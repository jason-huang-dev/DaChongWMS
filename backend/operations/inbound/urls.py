from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import AdvanceShipmentNoticeViewSet, PurchaseOrderViewSet, PutawayTaskViewSet, ReceiptViewSet

app_name = "inbound"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path(
        "advance-shipment-notices/",
        _action(AdvanceShipmentNoticeViewSet, {"get": "list", "post": "create"}),
        name="advance-shipment-notice-list",
    ),
    re_path(
        r"^advance-shipment-notices/(?P<pk>\d+)/$",
        _action(AdvanceShipmentNoticeViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="advance-shipment-notice-detail",
    ),
    path(
        "purchase-orders/",
        _action(PurchaseOrderViewSet, {"get": "list", "post": "create"}),
        name="purchase-order-list",
    ),
    re_path(
        r"^purchase-orders/(?P<pk>\d+)/$",
        _action(
            PurchaseOrderViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="purchase-order-detail",
    ),
    path("receipts/", _action(ReceiptViewSet, {"get": "list", "post": "create"}), name="receipt-list"),
    path("receipts/scan-receive/", _action(ReceiptViewSet, {"post": "scan_receive"}), name="receipt-scan-receive"),
    re_path(r"^receipts/(?P<pk>\d+)/$", _action(ReceiptViewSet, {"get": "retrieve"}), name="receipt-detail"),
    path("putaway-tasks/", _action(PutawayTaskViewSet, {"get": "list"}), name="putaway-task-list"),
    path("putaway-tasks/scan-complete/", _action(PutawayTaskViewSet, {"post": "scan_complete"}), name="putaway-task-scan-complete"),
    re_path(
        r"^putaway-tasks/(?P<pk>\d+)/$",
        _action(PutawayTaskViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="putaway-task-detail",
    ),
    re_path(
        r"^putaway-tasks/(?P<pk>\d+)/complete/$",
        _action(PutawayTaskViewSet, {"post": "complete"}),
        name="putaway-task-complete",
    ),
]
