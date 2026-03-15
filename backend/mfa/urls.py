from django.urls import path

from .views import MFAStatusView, TOTPEnrollmentCreateView, TOTPEnrollmentVerifyView, verify_challenge

app_name = "mfa"

urlpatterns = [
    path("status/", MFAStatusView.as_view(), name="status"),
    path("enrollments/totp/", TOTPEnrollmentCreateView.as_view(), name="totp-enroll"),
    path("enrollments/totp/verify/", TOTPEnrollmentVerifyView.as_view(), name="totp-enroll-verify"),
    path("challenges/verify/", verify_challenge, name="challenge-verify"),
]
