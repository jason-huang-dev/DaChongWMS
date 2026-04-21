from __future__ import annotations

import hashlib
from urllib.parse import urlencode

from django.conf import settings

SOCIAL_PLACEHOLDER_EMAIL_DOMAIN = "social-login.invalid"
SOCIAL_PROVIDER_LABELS = {
    "apple": "Apple",
    "google": "Google",
    "weixin": "WeChat",
}


def social_provider_label(provider: str) -> str:
    return SOCIAL_PROVIDER_LABELS.get(provider, provider.replace("_", " ").title())


def build_social_placeholder_email(*, provider: str, uid: str) -> str:
    digest = hashlib.sha256(f"{provider}:{uid}".encode("utf-8")).hexdigest()[:24]
    return f"{provider}-{digest}@{SOCIAL_PLACEHOLDER_EMAIL_DOMAIN}"


def build_social_auth_redirect_url(params: dict[str, object]) -> str:
    serialized_params = {
        key: str(value)
        for key, value in params.items()
        if value is not None and value != ""
    }
    encoded_fragment = urlencode(serialized_params)
    return f"{settings.FRONTEND_SOCIAL_AUTH_CALLBACK_URL}#{encoded_fragment}"
