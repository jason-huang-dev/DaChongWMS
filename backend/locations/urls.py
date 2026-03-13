from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import LocationLockViewSet, LocationTypeViewSet, LocationViewSet, ZoneViewSet

app_name = "locations"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("zones/", _action(ZoneViewSet, {"get": "list", "post": "create"}), name="zone-list"),
    re_path(
        r"^zones/(?P<pk>\d+)/$",
        _action(ZoneViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="zone-detail",
    ),
    path("types/", _action(LocationTypeViewSet, {"get": "list", "post": "create"}), name="type-list"),
    re_path(
        r"^types/(?P<pk>\d+)/$",
        _action(
            LocationTypeViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="type-detail",
    ),
    path("locks/", _action(LocationLockViewSet, {"get": "list", "post": "create"}), name="lock-list"),
    re_path(
        r"^locks/(?P<pk>\d+)/$",
        _action(
            LocationLockViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="lock-detail",
    ),
    path("", _action(LocationViewSet, {"get": "list", "post": "create"}), name="location-list"),
    re_path(
        r"^(?P<pk>\d+)/$",
        _action(LocationViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="location-detail",
    ),
]
