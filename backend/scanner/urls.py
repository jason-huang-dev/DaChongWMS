from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import HandheldDeviceSessionViewSet, HandheldTelemetrySampleViewSet, OfflineReplayBatchViewSet

app_name = "scanner"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("device-sessions/", _action(HandheldDeviceSessionViewSet, {"get": "list", "post": "create"}), name="device-session-list"),
    re_path(r"^device-sessions/(?P<pk>\d+)/$", _action(HandheldDeviceSessionViewSet, {"get": "retrieve"}), name="device-session-detail"),
    re_path(r"^device-sessions/(?P<pk>\d+)/heartbeat/$", _action(HandheldDeviceSessionViewSet, {"post": "heartbeat"}), name="device-session-heartbeat"),
    re_path(r"^device-sessions/(?P<pk>\d+)/end/$", _action(HandheldDeviceSessionViewSet, {"post": "end"}), name="device-session-end"),
    path("telemetry-samples/", _action(HandheldTelemetrySampleViewSet, {"get": "list", "post": "create"}), name="telemetry-sample-list"),
    re_path(r"^telemetry-samples/(?P<pk>\d+)/$", _action(HandheldTelemetrySampleViewSet, {"get": "retrieve"}), name="telemetry-sample-detail"),
    path("offline-replay-batches/", _action(OfflineReplayBatchViewSet, {"get": "list", "post": "create"}), name="offline-replay-batch-list"),
    re_path(r"^offline-replay-batches/(?P<pk>\d+)/$", _action(OfflineReplayBatchViewSet, {"get": "retrieve"}), name="offline-replay-batch-detail"),
]
