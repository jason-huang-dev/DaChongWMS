"""Header token authentication compatible with the legacy API."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from types import SimpleNamespace
from typing import Any, Tuple

from django.contrib.auth.models import AnonymousUser
from django.utils.translation import gettext_lazy as _
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed
from rest_framework.request import Request

# cSpell:ignore Authtication

try:  # pragma: no cover - optional dependency
    from userprofile.models import Users as _LegacyUser
except Exception:  # pragma: no cover
    _LegacyUser = None
try:  # pragma: no cover - optional dependency
    from access.services import get_membership_for_profile as _get_membership_for_profile
except Exception:  # pragma: no cover
    _get_membership_for_profile = None

_DOC_WHITELIST = {"/api/docs/", "/api/debug/", "/api/"}


class Authtication(BaseAuthentication):
    """Authenticate requests via ``TOKEN`` header, mirroring GreaterWMS."""

    def authenticate(self, request: Request) -> Tuple[Any, Any] | None:
        if request.path in _DOC_WHITELIST:
            return None
        token = request.META.get("HTTP_TOKEN")
        if not token:
            raise AuthenticationFailed({"detail": "Please add TOKEN header"})
        if _LegacyUser is None:
            surrogate = SimpleNamespace(openid=token, appid=None)
            return AnonymousUser(), surrogate
        profile = _LegacyUser.objects.filter(openid__exact=str(token), is_delete=False).first()
        if not profile:
            raise AuthenticationFailed({"detail": "User does not exist"})
        membership = _get_membership_for_profile(profile) if _get_membership_for_profile is not None else None
        auth_user = get_user_model().objects.filter(id=profile.user_id).first() or AnonymousUser()
        if membership is None:
            return auth_user, profile
        principal = SimpleNamespace(
            openid=membership.company.openid,
            appid=profile.appid,
            user_id=profile.user_id,
            profile_id=profile.id,
            profile_token=profile.openid,
            membership_id=membership.id,
            company_id=membership.company_id,
            staff_id=membership.staff_id,
        )
        return auth_user, principal

    def authenticate_header(self, request: Request) -> str:
        return "Token"
