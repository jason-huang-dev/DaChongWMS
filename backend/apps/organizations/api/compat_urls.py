from django.urls import path, re_path

from .compat_views import (
    CompatibilityAuditEventListAPIView,
    CompatibilityDashboardOrderStatisticsAPIView,
    CompatibilityInviteAcceptanceAPIView,
    CompatibilityCompanyMembershipDetailAPIView,
    CompatibilityCompanyMembershipListCreateAPIView,
    CompatibilityInviteDetailAPIView,
    CompatibilityInviteListCreateAPIView,
    CompatibilityMembershipActivateAPIView,
    CompatibilityMyMembershipListAPIView,
    CompatibilityPasswordResetCompletionAPIView,
    CompatibilityPasswordResetDetailAPIView,
    CompatibilityPasswordResetListCreateAPIView,
    CompatibilityWorkbenchPreferenceAPIView,
    CompatibilityWorkspaceTabListAPIView,
    CompatibilityWorkspaceTabSyncAPIView,
)

urlpatterns = [
    path("access/my-memberships/", CompatibilityMyMembershipListAPIView.as_view(), name="compat-membership-list"),
    path(
        "access/company-memberships/",
        CompatibilityCompanyMembershipListCreateAPIView.as_view(),
        name="compat-company-membership-list",
    ),
    re_path(
        r"^access/company-memberships/(?P<membership_id>\d+)/$",
        CompatibilityCompanyMembershipDetailAPIView.as_view(),
        name="compat-company-membership-detail",
    ),
    path(
        "access/company-invites/",
        CompatibilityInviteListCreateAPIView.as_view(),
        name="compat-company-invite-list",
    ),
    path(
        "access/company-invites/accept/",
        CompatibilityInviteAcceptanceAPIView.as_view(),
        name="compat-company-invite-accept",
    ),
    re_path(
        r"^access/company-invites/(?P<invite_id>\d+)/$",
        CompatibilityInviteDetailAPIView.as_view(),
        name="compat-company-invite-detail",
    ),
    re_path(
        r"^access/company-invites/(?P<invite_id>\d+)/revoke/$",
        CompatibilityInviteDetailAPIView.as_view(),
        name="compat-company-invite-revoke",
    ),
    path(
        "access/password-resets/",
        CompatibilityPasswordResetListCreateAPIView.as_view(),
        name="compat-password-reset-list",
    ),
    path(
        "access/password-resets/complete/",
        CompatibilityPasswordResetCompletionAPIView.as_view(),
        name="compat-password-reset-complete",
    ),
    re_path(
        r"^access/password-resets/(?P<reset_id>\d+)/$",
        CompatibilityPasswordResetDetailAPIView.as_view(),
        name="compat-password-reset-detail",
    ),
    re_path(
        r"^access/password-resets/(?P<reset_id>\d+)/revoke/$",
        CompatibilityPasswordResetDetailAPIView.as_view(),
        name="compat-password-reset-revoke",
    ),
    path("access/audit-events/", CompatibilityAuditEventListAPIView.as_view(), name="compat-audit-list"),
    re_path(
        r"^access/my-memberships/(?P<membership_id>\d+)/activate/$",
        CompatibilityMembershipActivateAPIView.as_view(),
        name="compat-membership-activate",
    ),
    path("access/workspace-tabs/", CompatibilityWorkspaceTabListAPIView.as_view(), name="compat-workspace-tab-list"),
    path("access/workspace-tabs/sync/", CompatibilityWorkspaceTabSyncAPIView.as_view(), name="compat-workspace-tab-sync"),
    path(
        "access/workbench-preferences/current/",
        CompatibilityWorkbenchPreferenceAPIView.as_view(),
        name="compat-workbench-preference-current",
    ),
    path(
        "dashboard/order-statistics/",
        CompatibilityDashboardOrderStatisticsAPIView.as_view(),
        name="compat-dashboard-order-statistics",
    ),
]
