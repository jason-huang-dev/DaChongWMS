from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import AutomationAlertViewSet, BackgroundTaskViewSet, ScheduledTaskViewSet, WorkerHeartbeatViewSet

app_name = "automation"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("scheduled-tasks/", _action(ScheduledTaskViewSet, {"get": "list", "post": "create"}), name="scheduled-task-list"),
    re_path(
        r"^scheduled-tasks/(?P<pk>\d+)/$",
        _action(ScheduledTaskViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update", "delete": "destroy"}),
        name="scheduled-task-detail",
    ),
    re_path(r"^scheduled-tasks/(?P<pk>\d+)/run-now/$", _action(ScheduledTaskViewSet, {"post": "run_now"}), name="scheduled-task-run-now"),
    path("worker-heartbeats/", _action(WorkerHeartbeatViewSet, {"get": "list"}), name="worker-heartbeat-list"),
    re_path(r"^worker-heartbeats/(?P<pk>\d+)/$", _action(WorkerHeartbeatViewSet, {"get": "retrieve"}), name="worker-heartbeat-detail"),
    path("alerts/", _action(AutomationAlertViewSet, {"get": "list"}), name="alert-list"),
    re_path(r"^alerts/(?P<pk>\d+)/$", _action(AutomationAlertViewSet, {"get": "retrieve"}), name="alert-detail"),
    path("background-tasks/", _action(BackgroundTaskViewSet, {"get": "list"}), name="background-task-list"),
    path("background-tasks/dashboard/", _action(BackgroundTaskViewSet, {"get": "dashboard"}), name="background-task-dashboard"),
    path("background-tasks/evaluate-alerts/", _action(BackgroundTaskViewSet, {"post": "evaluate_alerts"}), name="background-task-evaluate-alerts"),
    re_path(r"^background-tasks/(?P<pk>\d+)/$", _action(BackgroundTaskViewSet, {"get": "retrieve"}), name="background-task-detail"),
    re_path(r"^background-tasks/(?P<pk>\d+)/retry/$", _action(BackgroundTaskViewSet, {"post": "retry"}), name="background-task-retry"),
]
