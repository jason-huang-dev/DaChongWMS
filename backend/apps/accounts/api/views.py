from __future__ import annotations

from django.conf import settings
from django.contrib.auth import logout
from django.http import Http404, HttpRequest, HttpResponseRedirect
from django.urls import reverse
from rest_framework.authentication import SessionAuthentication
from rest_framework.request import Request
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsActiveAuthenticated
from apps.accounts.services.session_service import build_authenticated_response, ensure_default_membership_for_user
from apps.accounts.social_auth import build_social_auth_redirect_url, social_provider_label
from apps.accounts.throttles import SocialAuthBeginRateThrottle, SocialAuthProviderListRateThrottle
from apps.accounts.serializers import CurrentUserSerializer


class CurrentUserAPIView(APIView):
    permission_classes = [IsActiveAuthenticated]

    def get(self, request: Request) -> Response:
        serializer = CurrentUserSerializer(request.user)
        return Response(serializer.data)


class SocialAuthProviderListAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]
    throttle_classes = [SocialAuthProviderListRateThrottle]

    def get(self, request: Request) -> Response:
        results = [
            {
                "id": provider,
                "label": social_provider_label(provider),
                "login_url": request.build_absolute_uri(
                    reverse("auth-social-begin", kwargs={"provider": provider})
                ),
            }
            for provider in settings.ENABLED_SOCIAL_AUTH_PROVIDERS
        ]
        return Response({"count": len(results), "results": results})


class SocialAuthBeginAPIView(APIView):
    authentication_classes: list[type[object]] = []
    permission_classes = [AllowAny]
    throttle_classes = [SocialAuthBeginRateThrottle]

    def get(self, request: Request, provider: str) -> HttpResponseRedirect:
        if provider not in settings.ENABLED_SOCIAL_AUTH_PROVIDERS:
            raise Http404("Unknown social auth provider.")

        provider_login_url = reverse(f"{provider}_login")
        redirect_url = f"{provider_login_url}?process=login&next={reverse('auth-social-complete')}"
        return HttpResponseRedirect(redirect_url)


class SocialAuthCompleteAPIView(APIView):
    authentication_classes = [SessionAuthentication]
    permission_classes = [AllowAny]

    def get(self, request: HttpRequest) -> HttpResponseRedirect:
        if not request.user.is_authenticated:
            return HttpResponseRedirect(
                build_social_auth_redirect_url({"error": "authentication_failed"})
            )

        membership = ensure_default_membership_for_user(request.user)
        payload = build_authenticated_response(membership=membership)
        logout(request)
        return HttpResponseRedirect(build_social_auth_redirect_url(payload))
