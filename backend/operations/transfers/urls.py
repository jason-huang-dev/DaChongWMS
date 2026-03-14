from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import ReplenishmentRuleViewSet, ReplenishmentTaskViewSet, TransferLineViewSet, TransferOrderViewSet

app_name = "transfers"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("transfer-orders/", _action(TransferOrderViewSet, {"get": "list", "post": "create"}), name="transfer-order-list"),
    re_path(
        r"^transfer-orders/(?P<pk>\d+)/$",
        _action(TransferOrderViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="transfer-order-detail",
    ),
    path("transfer-lines/", _action(TransferLineViewSet, {"get": "list"}), name="transfer-line-list"),
    re_path(
        r"^transfer-lines/(?P<pk>\d+)/$",
        _action(TransferLineViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="transfer-line-detail",
    ),
    re_path(r"^transfer-lines/(?P<pk>\d+)/complete/$", _action(TransferLineViewSet, {"post": "complete"}), name="transfer-line-complete"),
    path("replenishment-rules/", _action(ReplenishmentRuleViewSet, {"get": "list", "post": "create"}), name="replenishment-rule-list"),
    re_path(
        r"^replenishment-rules/(?P<pk>\d+)/$",
        _action(ReplenishmentRuleViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="replenishment-rule-detail",
    ),
    re_path(
        r"^replenishment-rules/(?P<pk>\d+)/generate-task/$",
        _action(ReplenishmentRuleViewSet, {"post": "generate_task"}),
        name="replenishment-rule-generate-task",
    ),
    path("replenishment-tasks/", _action(ReplenishmentTaskViewSet, {"get": "list"}), name="replenishment-task-list"),
    re_path(
        r"^replenishment-tasks/(?P<pk>\d+)/$",
        _action(ReplenishmentTaskViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="replenishment-task-detail",
    ),
    re_path(
        r"^replenishment-tasks/(?P<pk>\d+)/complete/$",
        _action(ReplenishmentTaskViewSet, {"post": "complete"}),
        name="replenishment-task-complete",
    ),
]
