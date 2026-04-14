from django.urls import path

from .compat_views import CompatibilityCountApprovalSummaryAPIView

urlpatterns = [
    path(
        "counting/approvals/summary/",
        CompatibilityCountApprovalSummaryAPIView.as_view(),
        name="compat-count-approval-summary",
    ),
]
