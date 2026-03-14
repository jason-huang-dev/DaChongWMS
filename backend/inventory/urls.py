from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import (
    InventoryAdjustmentApprovalRuleViewSet,
    InventoryAdjustmentReasonViewSet,
    InventoryBalanceViewSet,
    InventoryHoldViewSet,
    InventoryMovementViewSet,
)

app_name = "inventory"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("balances/", _action(InventoryBalanceViewSet, {"get": "list"}), name="balance-list"),
    re_path(r"^balances/(?P<pk>\d+)/$", _action(InventoryBalanceViewSet, {"get": "retrieve"}), name="balance-detail"),
    path("movements/", _action(InventoryMovementViewSet, {"get": "list", "post": "create"}), name="movement-list"),
    re_path(r"^movements/(?P<pk>\d+)/$", _action(InventoryMovementViewSet, {"get": "retrieve"}), name="movement-detail"),
    path("holds/", _action(InventoryHoldViewSet, {"get": "list", "post": "create"}), name="hold-list"),
    re_path(
        r"^holds/(?P<pk>\d+)/$",
        _action(InventoryHoldViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="hold-detail",
    ),
    path(
        "adjustment-reasons/",
        _action(InventoryAdjustmentReasonViewSet, {"get": "list", "post": "create"}),
        name="adjustment-reason-list",
    ),
    re_path(
        r"^adjustment-reasons/(?P<pk>\d+)/$",
        _action(
            InventoryAdjustmentReasonViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="adjustment-reason-detail",
    ),
    path(
        "adjustment-rules/",
        _action(InventoryAdjustmentApprovalRuleViewSet, {"get": "list", "post": "create"}),
        name="adjustment-rule-list",
    ),
    re_path(
        r"^adjustment-rules/(?P<pk>\d+)/$",
        _action(
            InventoryAdjustmentApprovalRuleViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="adjustment-rule-detail",
    ),
]
