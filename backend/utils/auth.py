"""Header token authentication compatible with the legacy API."""

from __future__ import annotations

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
        user = _LegacyUser.objects.filter(openid__exact=str(token)).first()
        if not user:
            raise AuthenticationFailed({"detail": "User does not exist"})
        return user, user

    def authenticate_header(self, request: Request) -> str:
        return "Token"
