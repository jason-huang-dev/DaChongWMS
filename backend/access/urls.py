from __future__ import annotations

from typing import Callable, Dict, List, cast

from django.http import HttpResponse
from django.urls import path, re_path
from django.urls.resolvers import URLPattern
from rest_framework.viewsets import ViewSet

from .views import (
    AccessAuditEventViewSet,
    CompanyInviteViewSet,
    CompanyMembershipViewSet,
    CompanyPasswordResetViewSet,
    InviteAcceptanceViewSet,
    MyCompanyMembershipViewSet,
    PasswordResetCompletionViewSet,
    QueueViewPreferenceViewSet,
    WorkspaceTabPreferenceViewSet,
    WorkbenchPreferenceViewSet,
)

app_name = "access"

ViewActionMap = Dict[str, str]
ViewCallable = Callable[..., HttpResponse]


def _action(view: type[ViewSet], mapping: ViewActionMap) -> ViewCallable:
    return cast(ViewCallable, view.as_view(mapping))


urlpatterns: List[URLPattern] = [
    path("my-memberships/", _action(MyCompanyMembershipViewSet, {"get": "list"}), name="my-membership-list"),
    re_path(r"^my-memberships/(?P<pk>\d+)/$", _action(MyCompanyMembershipViewSet, {"get": "retrieve"}), name="my-membership-detail"),
    re_path(r"^my-memberships/(?P<pk>\d+)/activate/$", _action(MyCompanyMembershipViewSet, {"post": "activate"}), name="my-membership-activate"),
    path("company-memberships/", _action(CompanyMembershipViewSet, {"get": "list", "post": "create"}), name="company-membership-list"),
    re_path(r"^company-memberships/(?P<pk>\d+)/$", _action(CompanyMembershipViewSet, {"get": "retrieve", "patch": "partial_update"}), name="company-membership-detail"),
    path("company-invites/", _action(CompanyInviteViewSet, {"get": "list", "post": "create"}), name="company-invite-list"),
    path("company-invites/accept/", _action(InviteAcceptanceViewSet, {"post": "create"}), name="company-invite-accept"),
    re_path(r"^company-invites/(?P<pk>\d+)/$", _action(CompanyInviteViewSet, {"get": "retrieve"}), name="company-invite-detail"),
    re_path(r"^company-invites/(?P<pk>\d+)/revoke/$", _action(CompanyInviteViewSet, {"post": "revoke"}), name="company-invite-revoke"),
    path("password-resets/", _action(CompanyPasswordResetViewSet, {"get": "list", "post": "create"}), name="password-reset-list"),
    path("password-resets/complete/", _action(PasswordResetCompletionViewSet, {"post": "create"}), name="password-reset-complete"),
    re_path(r"^password-resets/(?P<pk>\d+)/$", _action(CompanyPasswordResetViewSet, {"get": "retrieve"}), name="password-reset-detail"),
    re_path(r"^password-resets/(?P<pk>\d+)/revoke/$", _action(CompanyPasswordResetViewSet, {"post": "revoke"}), name="password-reset-revoke"),
    path("audit-events/", _action(AccessAuditEventViewSet, {"get": "list"}), name="audit-event-list"),
    re_path(r"^audit-events/(?P<pk>\d+)/$", _action(AccessAuditEventViewSet, {"get": "retrieve"}), name="audit-event-detail"),
    path("queue-view-preferences/", _action(QueueViewPreferenceViewSet, {"get": "list", "post": "create"}), name="queue-view-preference-list"),
    re_path(
        r"^queue-view-preferences/(?P<pk>\d+)/$",
        _action(QueueViewPreferenceViewSet, {"get": "retrieve", "patch": "partial_update", "delete": "destroy"}),
        name="queue-view-preference-detail",
    ),
    path("workspace-tabs/", _action(WorkspaceTabPreferenceViewSet, {"get": "list"}), name="workspace-tab-list"),
    path("workspace-tabs/sync/", _action(WorkspaceTabPreferenceViewSet, {"post": "sync"}), name="workspace-tab-sync"),
    re_path(r"^workspace-tabs/(?P<pk>\d+)/$", _action(WorkspaceTabPreferenceViewSet, {"get": "retrieve", "delete": "destroy"}), name="workspace-tab-detail"),
    re_path(r"^workspace-tabs/(?P<pk>\d+)/activate/$", _action(WorkspaceTabPreferenceViewSet, {"post": "activate"}), name="workspace-tab-activate"),
    path("workbench-preferences/current/", _action(WorkbenchPreferenceViewSet, {"get": "current", "patch": "current"}), name="workbench-preference-current"),
]
