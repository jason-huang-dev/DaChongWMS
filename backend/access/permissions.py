"""Permissions for company membership management."""

from __future__ import annotations

from django.contrib.auth import get_user_model
from rest_framework.permissions import BasePermission

from utils.operator import get_request_operator

from .services import get_preferred_membership_for_auth_user, membership_can_manage_users


class CanManageCompanyMembers(BasePermission):
    message = "Only company admins or managers can manage company accounts."

    def has_permission(self, request, view) -> bool:
        auth_context = getattr(request, "auth", None)
        if auth_context is None:
            return False
        auth_user_id = getattr(auth_context, "user_id", None)
        if not isinstance(auth_user_id, int):
            return False
        auth_user = get_user_model().objects.filter(id=auth_user_id).first()
        if auth_user is None:
            return False
        openid = getattr(auth_context, "openid", None)
        profile_token = getattr(auth_context, "profile_token", None)
        membership = get_preferred_membership_for_auth_user(
            auth_user=auth_user,
            company_openid=openid if isinstance(openid, str) else None,
            profile_token=profile_token if isinstance(profile_token, str) else None,
        )
        if membership is None:
            operator = get_request_operator(request)
            return operator.staff_type in {"Manager", "Supervisor"}
        return membership_can_manage_users(membership)
