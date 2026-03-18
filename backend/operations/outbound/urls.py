from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import DockLoadVerificationViewSet, PickTaskViewSet, SalesOrderViewSet, ShipmentViewSet, ShortPickRecordViewSet

app_name = "outbound"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("sales-orders/", _action(SalesOrderViewSet, {"get": "list", "post": "create"}), name="sales-order-list"),
    re_path(
        r"^sales-orders/(?P<pk>\d+)/$",
        _action(SalesOrderViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="sales-order-detail",
    ),
    re_path(r"^sales-orders/(?P<pk>\d+)/allocate/$", _action(SalesOrderViewSet, {"post": "allocate"}), name="sales-order-allocate"),
    path("pick-tasks/", _action(PickTaskViewSet, {"get": "list"}), name="pick-task-list"),
    path("pick-tasks/scan-complete/", _action(PickTaskViewSet, {"post": "scan_complete"}), name="pick-task-scan-complete"),
    re_path(
        r"^pick-tasks/(?P<pk>\d+)/$",
        _action(PickTaskViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="pick-task-detail",
    ),
    re_path(r"^pick-tasks/(?P<pk>\d+)/complete/$", _action(PickTaskViewSet, {"post": "complete"}), name="pick-task-complete"),
    re_path(
        r"^pick-tasks/(?P<pk>\d+)/report-short-pick/$",
        _action(PickTaskViewSet, {"post": "report_short_pick"}),
        name="pick-task-report-short-pick",
    ),
    path("shipments/", _action(ShipmentViewSet, {"get": "list", "post": "create"}), name="shipment-list"),
    path("shipments/scan-ship/", _action(ShipmentViewSet, {"post": "scan_ship"}), name="shipment-scan-ship"),
    re_path(r"^shipments/(?P<pk>\d+)/$", _action(ShipmentViewSet, {"get": "retrieve"}), name="shipment-detail"),
    path("dock-load-verifications/", _action(DockLoadVerificationViewSet, {"get": "list"}), name="dock-load-verification-list"),
    re_path(r"^dock-load-verifications/(?P<pk>\d+)/$", _action(DockLoadVerificationViewSet, {"get": "retrieve"}), name="dock-load-verification-detail"),
    path("short-picks/", _action(ShortPickRecordViewSet, {"get": "list"}), name="short-pick-list"),
    re_path(r"^short-picks/(?P<pk>\d+)/$", _action(ShortPickRecordViewSet, {"get": "retrieve"}), name="short-pick-detail"),
    re_path(r"^short-picks/(?P<pk>\d+)/resolve/$", _action(ShortPickRecordViewSet, {"post": "resolve"}), name="short-pick-resolve"),
]
