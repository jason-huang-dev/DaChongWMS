from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import ReturnDispositionViewSet, ReturnOrderViewSet, ReturnReceiptViewSet

app_name = "returns"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("return-orders/", _action(ReturnOrderViewSet, {"get": "list", "post": "create"}), name="return-order-list"),
    re_path(
        r"^return-orders/(?P<pk>\d+)/$",
        _action(ReturnOrderViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="return-order-detail",
    ),
    path("receipts/", _action(ReturnReceiptViewSet, {"get": "list", "post": "create"}), name="receipt-list"),
    re_path(r"^receipts/(?P<pk>\d+)/$", _action(ReturnReceiptViewSet, {"get": "retrieve"}), name="receipt-detail"),
    path("dispositions/", _action(ReturnDispositionViewSet, {"get": "list", "post": "create"}), name="disposition-list"),
    re_path(r"^dispositions/(?P<pk>\d+)/$", _action(ReturnDispositionViewSet, {"get": "retrieve"}), name="disposition-detail"),
]
