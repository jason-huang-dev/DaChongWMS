from __future__ import annotations

from rest_framework.permissions import BasePermission
from rest_framework.request import Request
from rest_framework.views import APIView

from apps.iam.constants import PermissionCode
from apps.iam.permissions import get_active_membership, user_has_organization_permission
from apps.organizations.models import MembershipType
from apps.partners.models import CustomerAccount
from apps.partners.services.customer_accounts import (
    get_customer_account_scope,
    list_visible_customer_accounts,
)


class CanViewCustomerAccounts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        if user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
        ):
            return True
        membership = get_active_membership(request.user, organization)
        if membership is None:
            return False
        if membership.membership_type != MembershipType.CLIENT:
            return False
        return bool(list_visible_customer_accounts(membership))


class CanManageCustomerAccounts(BasePermission):
    def has_permission(self, request: Request, view: APIView) -> bool:
        organization = getattr(view, "organization", None)
        if organization is None:
            return False
        return user_has_organization_permission(
            request.user,
            organization,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
        )


class CanViewCustomerAccountDetail(BasePermission):
    def has_object_permission(self, request: Request, view: APIView, obj: CustomerAccount) -> bool:
        if user_has_organization_permission(
            request.user,
            obj.organization,
            PermissionCode.MANAGE_CUSTOMER_ACCOUNTS,
        ):
            return True
        scope = get_customer_account_scope(obj)
        return user_has_organization_permission(
            request.user,
            obj.organization,
            PermissionCode.VIEW_CUSTOMER_ACCOUNT,
            scope=scope,
        )
