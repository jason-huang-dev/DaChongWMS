from django.urls import path

from .compat_views import (
    CompatibilityMfaStatusAPIView,
    CompatibilityStaffDetailAPIView,
    CompatibilityStaffListAPIView,
    CompatibilityStaffTypeListAPIView,
    LegacyLoginAPIView,
    LegacySignupAPIView,
    TestSystemBootstrapAPIView,
)

urlpatterns = [
    path("login/", LegacyLoginAPIView.as_view(), name="compat-login"),
    path("signup/", LegacySignupAPIView.as_view(), name="compat-signup"),
    path("test-system/register/", TestSystemBootstrapAPIView.as_view(), name="compat-test-system-register"),
    path("staff/", CompatibilityStaffListAPIView.as_view(), name="compat-staff-list"),
    path("staff/type/", CompatibilityStaffTypeListAPIView.as_view(), name="compat-staff-type-list"),
    path("staff/<int:staff_id>/", CompatibilityStaffDetailAPIView.as_view(), name="compat-staff-detail"),
    path("mfa/status/", CompatibilityMfaStatusAPIView.as_view(), name="compat-mfa-status"),
]
