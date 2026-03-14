from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import CountApprovalViewSet, CycleCountLineViewSet, CycleCountViewSet

app_name = "counting"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("cycle-counts/", _action(CycleCountViewSet, {"get": "list", "post": "create"}), name="cycle-count-list"),
    re_path(r"^cycle-counts/(?P<pk>\d+)/$", _action(CycleCountViewSet, {"get": "retrieve"}), name="cycle-count-detail"),
    re_path(r"^cycle-counts/(?P<pk>\d+)/submit/$", _action(CycleCountViewSet, {"post": "submit"}), name="cycle-count-submit"),
    path("cycle-count-lines/", _action(CycleCountLineViewSet, {"get": "list"}), name="cycle-count-line-list"),
    path("cycle-count-lines/my-assignments/", _action(CycleCountLineViewSet, {"get": "my_assignments"}), name="cycle-count-line-my-assignments"),
    path("cycle-count-lines/next-task/", _action(CycleCountLineViewSet, {"get": "next_task"}), name="cycle-count-line-next-task"),
    path("cycle-count-lines/scan-lookup/", _action(CycleCountLineViewSet, {"post": "scan_lookup"}), name="cycle-count-line-scan-lookup"),
    path("cycle-count-lines/scan-count/", _action(CycleCountLineViewSet, {"post": "scan_count"}), name="cycle-count-line-scan-count"),
    re_path(
        r"^cycle-count-lines/(?P<pk>\d+)/$",
        _action(CycleCountLineViewSet, {"get": "retrieve", "put": "update", "patch": "partial_update"}),
        name="cycle-count-line-detail",
    ),
    re_path(r"^cycle-count-lines/(?P<pk>\d+)/assign/$", _action(CycleCountLineViewSet, {"post": "assign"}), name="cycle-count-line-assign"),
    re_path(r"^cycle-count-lines/(?P<pk>\d+)/scanner-ack/$", _action(CycleCountLineViewSet, {"post": "scanner_ack"}), name="cycle-count-line-scanner-ack"),
    re_path(r"^cycle-count-lines/(?P<pk>\d+)/scanner-start/$", _action(CycleCountLineViewSet, {"post": "scanner_start"}), name="cycle-count-line-scanner-start"),
    re_path(r"^cycle-count-lines/(?P<pk>\d+)/scanner-complete/$", _action(CycleCountLineViewSet, {"post": "scanner_complete"}), name="cycle-count-line-scanner-complete"),
    re_path(
        r"^cycle-count-lines/(?P<pk>\d+)/assign-recount/$",
        _action(CycleCountLineViewSet, {"post": "assign_recount"}),
        name="cycle-count-line-assign-recount",
    ),
    re_path(r"^cycle-count-lines/(?P<pk>\d+)/recount/$", _action(CycleCountLineViewSet, {"post": "recount"}), name="cycle-count-line-recount"),
    path("approvals/", _action(CountApprovalViewSet, {"get": "list"}), name="approval-list"),
    path("approvals/queue/", _action(CountApprovalViewSet, {"get": "queue"}), name="approval-queue"),
    path("approvals/summary/", _action(CountApprovalViewSet, {"get": "summary"}), name="approval-summary"),
    path("approvals/dashboard/", _action(CountApprovalViewSet, {"get": "dashboard"}), name="approval-dashboard"),
    path("approvals/dashboard/export/", _action(CountApprovalViewSet, {"get": "dashboard_export"}), name="approval-dashboard-export"),
    re_path(r"^approvals/(?P<pk>\d+)/$", _action(CountApprovalViewSet, {"get": "retrieve"}), name="approval-detail"),
    re_path(r"^approvals/(?P<pk>\d+)/approve/$", _action(CountApprovalViewSet, {"post": "approve"}), name="approval-approve"),
    re_path(r"^approvals/(?P<pk>\d+)/reject/$", _action(CountApprovalViewSet, {"post": "reject"}), name="approval-reject"),
]
