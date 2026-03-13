from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import StaffFileDownloadView, StaffTypeViewSet, StaffViewSet

app_name = "staff"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("", _action(StaffViewSet, {"get": "list", "post": "create"}), name="staff"),
    re_path(
        r"^(?P<pk>\d+)/$",
        _action(
            StaffViewSet,
            {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"},
        ),
        name="staff-detail",
    ),
    path("type/", _action(StaffTypeViewSet, {"get": "list"}), name="staff-type"),
    path("file/", _action(StaffFileDownloadView, {"get": "list"}), name="staff-file"),
]
