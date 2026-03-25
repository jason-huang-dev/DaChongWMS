from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from django.core import signing
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

from apps.accounts.models import User
from apps.accounts.services.session_service import ensure_operator_profile, get_authenticated_membership, parse_session_token


class LegacyHeaderAuthentication(BaseAuthentication):
    """Authenticate first-class app requests from the legacy header contract."""

    def authenticate(self, request: Request) -> tuple[User, Any] | None:
        token = request.META.get("HTTP_TOKEN")
        if not token:
            return None

        try:
            claims = parse_session_token(str(token))
        except signing.SignatureExpired as exc:
            raise AuthenticationFailed("Session token has expired.") from exc
        except signing.BadSignature as exc:
            raise AuthenticationFailed("Invalid session token.") from exc

        user = User.objects.filter(id=claims.user_id, is_active=True).first()
        if user is None:
            raise AuthenticationFailed("Authenticated user was not found.")

        principal = SimpleNamespace(membership_id=claims.membership_id)
        membership = get_authenticated_membership(user=user, auth=principal)
        if membership is None:
            raise AuthenticationFailed("Active organization membership was not found.")
        operator_profile = ensure_operator_profile(membership)

        request._cached_current_membership = membership  # type: ignore[attr-defined]
        legacy_principal = SimpleNamespace(
            openid=membership.organization.slug,
            appid=None,
            user_id=user.id,
            profile_id=None,
            profile_token=str(token),
            membership_id=membership.id,
            company_id=membership.organization_id,
            staff_id=operator_profile.id,
        )
        return user, legacy_principal

    def authenticate_header(self, request: Request) -> str:
        return "Token"
