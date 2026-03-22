from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import get_active_membership, user_has_organization_permission
from apps.partners.models import CustomerAccount
from apps.partners.services.customer_accounts import get_customer_account_scope


class IsOrganizationMember(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if organization is None:
            return False
        return get_active_membership(request.user, organization) is not None


class CanManageOrganizationUsers(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if not request.user or not request.user.is_authenticated:
            return False
        if request.user.is_superuser:
            return True
        if organization is None:
            return False

        if request.method != "POST":
            return True

        request_data = getattr(request, "data", None)
        if request_data is None:
            request_data = request.POST

        membership_type = request_data.get("membership_type")
        if membership_type == "CLIENT":
            customer_account_id = request_data.get("customer_account_id")
            if user_has_organization_permission(
                request.user,
                organization,
                PermissionCode.MANAGE_MEMBERSHIPS,
            ):
                return True
            if not customer_account_id:
                return get_active_membership(request.user, organization) is not None
            customer_account = CustomerAccount.objects.filter(
                pk=customer_account_id,
                organization=organization,
                is_active=True,
            ).first()
            if customer_account is None:
                return get_active_membership(request.user, organization) is not None
            return user_has_organization_permission(
                request.user,
                organization,
                PermissionCode.MANAGE_CLIENT_USERS,
                scope=get_customer_account_scope(customer_account),
            )

        return (
            user_has_organization_permission(
                request.user,
                organization,
                PermissionCode.MANAGE_MEMBERSHIPS,
            )
            or user_has_organization_permission(
                request.user,
                organization,
                PermissionCode.MANAGE_CLIENT_USERS,
            )
        )
