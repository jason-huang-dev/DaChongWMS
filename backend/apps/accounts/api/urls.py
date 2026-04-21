from django.urls import path

from .views import (
    CurrentUserAPIView,
    SocialAuthBeginAPIView,
    SocialAuthCompleteAPIView,
    SocialAuthProviderListAPIView,
    WorkspaceOnboardingAPIView,
)

urlpatterns = [
    path("me/", CurrentUserAPIView.as_view(), name="auth-current-user"),
    path("onboarding/workspace-setup/", WorkspaceOnboardingAPIView.as_view(), name="auth-workspace-onboarding"),
    path("social/providers/", SocialAuthProviderListAPIView.as_view(), name="auth-social-provider-list"),
    path("social/<str:provider>/begin/", SocialAuthBeginAPIView.as_view(), name="auth-social-begin"),
    path("social/complete/", SocialAuthCompleteAPIView.as_view(), name="auth-social-complete"),
]
