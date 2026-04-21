from __future__ import annotations

from django.contrib.auth import get_user_model
from django.shortcuts import redirect
from django.urls import reverse

from allauth.account.adapter import DefaultAccountAdapter
from allauth.account.utils import user_email, user_field
from allauth.core.exceptions import ImmediateHttpResponse
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from apps.accounts.social_auth import build_social_auth_redirect_url, build_social_placeholder_email

User = get_user_model()


def _social_full_name(data: dict[str, object]) -> str:
    name = str(data.get("name") or "").strip()
    if name:
        return name
    first_name = str(data.get("first_name") or "").strip()
    last_name = str(data.get("last_name") or "").strip()
    return " ".join(part for part in (first_name, last_name) if part).strip()


def _verified_social_email(sociallogin) -> str:
    for email_address in sociallogin.email_addresses:
        if getattr(email_address, "verified", False) and email_address.email:
            return email_address.email.strip().lower()

    account_email = str(user_email(sociallogin.user) or "").strip().lower()
    email_verified = sociallogin.account.extra_data.get("email_verified")
    if account_email and email_verified is True:
        return account_email

    return ""


class WarehouseAccountAdapter(DefaultAccountAdapter):
    def populate_username(self, request, user) -> None:
        if getattr(user, "email", ""):
            user.username = user.email
            return
        super().populate_username(request, user)

    def get_login_redirect_url(self, request):
        return reverse("auth-social-complete")

    def get_signup_redirect_url(self, request):
        return reverse("auth-social-complete")


class WarehouseSocialAccountAdapter(DefaultSocialAccountAdapter):
    def pre_social_login(self, request, sociallogin):
        if sociallogin.is_existing:
            return

        verified_email = _verified_social_email(sociallogin)
        if not verified_email:
            return

        existing_user = User.objects.filter(email__iexact=verified_email).first()
        if existing_user is None:
            return

        sociallogin.connect(request, existing_user)

    def populate_user(self, request, sociallogin, data):
        user = super().populate_user(request, sociallogin, data)
        full_name = _social_full_name(data)
        if full_name:
            user_field(user, "full_name", full_name)

        verified_email = _verified_social_email(sociallogin)
        if verified_email:
            user_email(user, verified_email)
        else:
            placeholder_email = build_social_placeholder_email(
                provider=sociallogin.account.provider,
                uid=sociallogin.account.uid,
            )
            user_email(user, placeholder_email)
        return user

    def on_authentication_error(
        self,
        request,
        provider,
        error=None,
        exception=None,
        extra_context=None,
    ):
        redirect_response = redirect(
            build_social_auth_redirect_url(
                {
                    "error": "authentication_failed",
                    "provider": provider.id,
                }
            )
        )
        raise ImmediateHttpResponse(redirect_response)
