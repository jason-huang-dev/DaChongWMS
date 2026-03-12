from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from django.http import HttpResponse
from rest_framework.viewsets import ViewSet

from .views import WarehouseMultipleViewSet, WarehouseViewSet

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("", _action(WarehouseViewSet, {"get": "list", "post": "create"}), name="warehouse-list"),
    re_path(
        r"^(?P<pk>\d+)/$",
        _action(
            WarehouseViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="warehouse-detail",
    ),
    path("multiple/", _action(WarehouseMultipleViewSet, {"get": "list"}), name="warehouse-multiple"),
    re_path(
        r"^multiple/(?P<pk>\d+)/$",
        _action(WarehouseMultipleViewSet, {"get": "retrieve"}),
        name="warehouse-multiple-detail",
    ),
]
